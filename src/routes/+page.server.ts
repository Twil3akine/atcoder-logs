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

const CACHE_KEY_PREFIX = 'submissions_v1_';
const CACHE_TTL = 60 * 60 * 24 * 7; // 1週間（アクセスがあるたびに延長される）

async function getUserSubmissions(username: string, platform?: App.Platform): Promise<Map<string, string>> {
	const statusMap = new Map<string, string>();
	let cachedSubmissions: Submission[] = [];
	let fromSecond = 0;

	// 1. キャッシュの読み込み (KVが使える場合)
	const cache = platform?.env?.ATCODER_CACHE;
	const cacheKey = `${CACHE_KEY_PREFIX}${username}`;

	if (cache) {
		try {
			const cachedJson = await cache.get(cacheKey, 'json') as CachedData | null;
			if (cachedJson && cachedJson.submissions) {
				console.log(`Cache hit for ${username}: ${cachedJson.submissions.length} submissions found.`);
				cachedSubmissions = cachedJson.submissions;

				// 最後に取得した時刻の「1秒後」から新しいデータを取る
				// (Submissionは時系列とは限らないが、epoch_secondで管理すればOK)
				if (cachedSubmissions.length > 0) {
					const maxEpoch = Math.max(...cachedSubmissions.map(s => s.epoch_second));
					fromSecond = maxEpoch + 1;
				}
			}
		} catch (e) {
			console.warn('Cache read error:', e);
		}
	}

	// 2. APIから差分（または全件）を取得
	const newSubmissions: Submission[] = [];
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
					'Accept': 'application/json'
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
			const maxInChunk = Math.max(...chunk.map(s => s.epoch_second));
			if (maxInChunk >= fromSecond) {
				fromSecond = maxInChunk + 1;
			}

			if (chunk.length < 500) hasMore = false;
			if (hasMore) await new Promise(r => setTimeout(r, 200));

		} catch (e) {
			console.error('API Fetch Error:', e);
			break;
		}
	}

	// 3. キャッシュと新データをマージ
	// 重複排除のためにMapを使う (IDをキーにする)
	const submissionMap = new Map<number, Submission>();

	// 古いデータをセット
	cachedSubmissions.forEach(s => submissionMap.set(s.id, s));
	// 新しいデータをセット（更新があれば上書きされる）
	newSubmissions.forEach(s => submissionMap.set(s.id, s));

	const mergedSubmissions = Array.from(submissionMap.values());

	// 4. 新しいデータがあったらキャッシュを更新
	if (cache && newSubmissions.length > 0) {
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
			// platformを渡すのを忘れずに！
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

		const problemsByContest = problemsWithNotes.reduce(
			(acc, problem) => {
				const contestId = problem.contestId;
				if (!acc[contestId]) {
					acc[contestId] = [];
				}
				acc[contestId].push(problem);
				return acc;
			},
			{} as Record<string, typeof problemsWithNotes>
		);

		return {
			problemsByContest
		};

	} catch (err) {
		console.error('Database or API Error:', err);
		return {
			problemsByContest: {},
			error: 'データの取得中にエラーが発生しました。'
		};
	}
};