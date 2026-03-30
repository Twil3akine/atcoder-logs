import { getDb } from '$lib/server/db';
import { problems, myNotes } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

interface Submission {
	result: string;
	problem_id: string;
	epoch_second: number;
	id: number;
	contest_id: string;
	language: string;
	point: number;
	length: number;
	execution_time?: number;
	memory?: number;
}

// キャッシュに保存するデータの形
interface CachedData {
	lastUpdated: number; // 最終更新時刻（UNIX秒）
	submissions: Submission[];
}

const CACHE_KEY_PREFIX = 'submissions_v1_1';
const CACHE_TTL = 60 * 60 * 24 * 7; // 1週間（アクセスがあるたびに延長される）

async function getUserSubmissions(
	username: string,
	platform?: App.Platform
): Promise<Map<string, string>> {
	const statusMap = new Map<string, string>();
	let cachedSubmissions: Submission[] = [];
	let fromSecond = 0;

	// APIを叩くかどうかのフラグ (デフォルトはtrue)
	let shouldFetch = true;

	// 1. キャッシュの読み込み (KVが使える場合)
	const cache = platform?.env?.ATCODER_CACHE;
	const cacheKey = `${CACHE_KEY_PREFIX}${username}`;

	if (cache) {
		try {
			const cachedJson = (await cache.get(cacheKey, 'json')) as CachedData | null;
			if (cachedJson && cachedJson.submissions) {
				console.log(
					`Cache hit for ${username}: ${cachedJson.submissions.length} submissions found.`
				);
				cachedSubmissions = cachedJson.submissions;

				// ▼▼▼ 追加: クールダウン判定 (15分以内ならAPI取得をスキップ) ▼▼▼
				const now = Math.floor(Date.now() / 1000);
				// 前回の更新から15分 (900秒) 以内ならスキップ
				if (cachedJson.lastUpdated && now - cachedJson.lastUpdated < 900) {
					console.log('Skipping API fetch (Cache is fresh)');
					shouldFetch = false;
				}
				// ▲▲▲ 追加ここまで ▲▲▲

				// ▼▼▼ 修正箇所: 3日 (259200秒) ほど巻き戻して取得開始する ▼▼▼
				if (cachedSubmissions.length > 0) {
					const maxEpoch = Math.max(...cachedSubmissions.map((s) => s.epoch_second));

					// 「最新 + 1秒」ではなく「最新 - 3日」にする
					// これで直近の抜け漏れや、AtCoder側のジャッジ遅延があっても次回拾える
					const SAFETY_MARGIN = 60 * 60 * 24 * 3;
					fromSecond = Math.max(0, maxEpoch - SAFETY_MARGIN);
				}
			}
		} catch (e) {
			console.warn('Cache read error:', e);
		}
	}

	// 2. APIから差分（または全件）を取得
	const newSubmissions: Submission[] = [];

	// shouldFetch が true のときだけ実行
	if (shouldFetch) {
		let hasMore = true;
		let loopCount = 0;
		const MAX_LOOPS = 20;

		console.log(`Fetching submissions from epoch: ${fromSecond}`);

		while (hasMore && loopCount < MAX_LOOPS) {
			loopCount++;
			const apiUrl = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${username}&from_second=${fromSecond}`;

			try {
				const response = await fetch(apiUrl, {
					headers: {
						'User-Agent': 'Twil3-AtCoderViewer/1.0 (Bun; +https://atcoder.jp)',
						'Accept-Encoding': 'gzip',
						Accept: 'application/json'
					}
				});

				if (!response.ok) break;

				const chunk: Submission[] = await response.json();

				if (chunk.length === 0) {
					hasMore = false;
					break;
				}

				console.log(`Fetched ${chunk.length} new submissions.`);
				newSubmissions.push(...chunk);

				// 次のページへ
				const maxInChunk = Math.max(...chunk.map((s) => s.epoch_second));
				if (maxInChunk >= fromSecond) {
					fromSecond = maxInChunk + 1;
				}

				if (chunk.length < 500) hasMore = false;
				if (hasMore) await new Promise((r) => setTimeout(r, 200));
			} catch (e) {
				console.error('API Fetch Error:', e);
				break;
			}
		}
	}

	// 3. キャッシュと新データをマージ
	// 重複排除のためにMapを使う (IDをキーにする)
	const submissionMap = new Map<number, Submission>();

	// 古いデータをセット
	cachedSubmissions.forEach((s) => submissionMap.set(s.id, s));
	// 新しいデータをセット（更新があれば上書きされる）
	newSubmissions.forEach((s) => submissionMap.set(s.id, s));

	const mergedSubmissions = Array.from(submissionMap.values());

	// 4. 新しいデータがあったらキャッシュを更新
	// 新しいデータを取ってきた時だけキャッシュを書き換える
	if (cache && shouldFetch && newSubmissions.length > 0) {
		const cacheData: CachedData = {
			lastUpdated: Math.floor(Date.now() / 1000),
			submissions: mergedSubmissions
		};
		// バックグラウンドで保存（awaitしないことでレスポンスを速くする技もあるが、SvelteKitのサーバーレスだとawait推奨）
		await cache.put(cacheKey, JSON.stringify(cacheData), { expirationTtl: CACHE_TTL });
		console.log(`Cache updated. Total: ${mergedSubmissions.length}`);
	}

	// 5. 結果のMapを作成 (AC > WA の優先順位ロジック)
	for (const submission of mergedSubmissions) {
		const currentStatus = statusMap.get(submission.problem_id);

		if (submission.result === 'AC') {
			statusMap.set(submission.problem_id, 'AC');
		} else if (!currentStatus) {
			statusMap.set(submission.problem_id, submission.result);
		}
	}

	return statusMap;
}

export const load: PageServerLoad = async ({ platform }) => {
	try {
		const db = getDb(platform);

		const [allProblems, allNotes, userSubmissions] = await Promise.all([
			db.select().from(problems),
			db.select().from(myNotes),
			getUserSubmissions('twil3', platform)
		]);

		const notesMap = new Map(allNotes.map((note) => [note.problemId, note]));

		const problemsWithNotes = allProblems.map((problem) => {
			const submissionResult = userSubmissions.get(problem.id);
			const note = notesMap.get(problem.id);
			return {
				...problem,
				note,
				submissionStatus: submissionResult || null
			};
		});

		// サーバー側で問題をカラムごとに割り当てた2次元辞書を作る
		const problemsGrid: Record<string, Record<string, (typeof problemsWithNotes)[0]>> = {};

		for (const problem of problemsWithNotes) {
			const contestId = problem.contestId;
			if (!problemsGrid[contestId]) {
				problemsGrid[contestId] = {};
			}

			// どの列(A, B, C...)に入るか判定
			const prefix = contestId.toLowerCase() + '_';
			let numStr = '';
			if (problem.id.toLowerCase().startsWith(prefix)) {
				numStr = problem.id.slice(prefix.length).toUpperCase();
			} else {
				const parts = problem.id.split('_');
				numStr = parts[parts.length - 1].toUpperCase();
			}

			// 数字表記（1, 2, 3...）をアルファベットに変換
			const numericMap: Record<string, string> = {
				'1': 'A',
				'2': 'B',
				'3': 'C',
				'4': 'D',
				'5': 'E',
				'6': 'F',
				'7': 'G',
				'8': 'H'
			};
			let col = numericMap[numStr] || numStr;

			// EXはH列として扱う
			if (col === 'EX') col = 'H';

			problemsGrid[contestId][col] = problem;
		}

		// problemsByContestではなくproblemsGridのキーを使ってソートする
		const sortedContestIds = Object.keys(problemsGrid).sort((a, b) => {
			const regex = /^([a-zA-Z]+)(\d+)$/;
			const matchA = a.match(regex);
			const matchB = b.match(regex);

			if (matchA && matchB) {
				const prefixA = matchA[1].toUpperCase();
				const prefixB = matchB[1].toUpperCase();
				const numA = parseInt(matchA[2], 10);
				const numB = parseInt(matchB[2], 10);

				if (prefixA !== prefixB) {
					return prefixA.localeCompare(prefixB);
				}
				return numB - numA;
			}

			if (matchA) return -1;
			if (matchB) return 1;

			return b.localeCompare(a);
		});

		return {
			problemsGrid, // problemsByContestをproblemsGridに変更
			sortedContestIds,
			error: null
		};
	} catch (err) {
		console.error('Database or API Error:', err);
		return {
			problemsByContest: {} as Record<string, any[]>, // Cast to satisfy type
			sortedContestIds: [],
			error: 'データの取得中にエラーが発生しました。'
		};
	}
};
