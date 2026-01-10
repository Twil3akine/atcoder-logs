import { getDb } from '$lib/server/db';
import { problems, myNotes } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

interface Submission {
	result: string;
	problem_id: string;
}

async function getUserSubmissions(username: string): Promise<Map<string, string>> {
	try {
		// 動作する例のタイムスタンプを使用（2019年6月9日）
		const response = await fetch(
			`https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${username}&from_second=0`,
			{
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; atcoder-garden/1.0)'
				}
			}
		);
		if (!response.ok) {
			console.warn(`Failed to fetch submissions for ${username}: ${response.statusText}`);
			return new Map();
		}
		const submissions: Submission[] = await response.json();

		// problem_idをキーにして、ACを優先して保持
		// ACがあればAC、なければWA、それもなければ最初の結果
		const statusMap = new Map<string, string>();
		for (const sub of submissions) {
			const current = statusMap.get(sub.problem_id);
			if (!current) {
				statusMap.set(sub.problem_id, sub.result);
			} else if (sub.result === 'AC') {
				// ACが最優先
				statusMap.set(sub.problem_id, 'AC');
			} else if (current !== 'AC' && (sub.result === 'WA' || sub.result.startsWith('WA'))) {
				// WAはACでない場合のみ更新
				statusMap.set(sub.problem_id, 'WA');
			}
		}
		return statusMap;
	} catch (err) {
		console.warn('Error fetching user submissions:', err);
		return new Map();
	}
}

export const load: PageServerLoad = async ({ platform }) => {
	try {
		const db = getDb(platform);
		const allProblems = await db.select().from(problems);
		const allNotes = await db.select().from(myNotes);

		// twil3ユーザーの提出状況を取得
		const userSubmissions = await getUserSubmissions('twil3');

		// ノートをproblemIdでマップ
		const notesMap = new Map(allNotes.map((note) => [note.problemId, note]));

		// 問題にノート情報と提出状況を追加
		const problemsWithNotes = allProblems.map((problem) => {
			const submissionResult = userSubmissions.get(problem.id);
			const note = notesMap.get(problem.id);
			return {
				...problem,
				note,
				submissionStatus: submissionResult || null // 'AC', 'WA', nullなど
			};
		});

		// コンテストIDでグループ化
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

		// コンテストIDをソート（ABC001から最新の順、降順で最新が上）
		const sortedContestIds = Object.keys(problemsByContest).sort((a, b) => {
			// ABC形式のコンテストIDを数値で比較（例: ABC439 > ABC001）
			const aMatch = a.match(/(\d+)$/);
			const bMatch = b.match(/(\d+)$/);
			if (aMatch && bMatch) {
				return parseInt(bMatch[1]) - parseInt(aMatch[1]); // 降順
			}
			return b.localeCompare(a); // 文字列として降順
		});

		// 各コンテストの問題を問題IDでソート（問題番号順）
		for (const contestId of sortedContestIds) {
			problemsByContest[contestId].sort((a, b) => a.id.localeCompare(b.id));
		}

		return {
			problemsByContest
		};
	} catch (err) {
		// 開発環境で platform が利用できない場合のフォールバック
		if (err instanceof Error && err.message.includes('D1 database binding is not available')) {
			return {
				problemsByContest: {},
				totalProblems: 0,
				error: 'データベースに接続できません。`wrangler dev` を使用して開発サーバーを起動してください。'
			};
		}
		throw error(500, 'データベースエラーが発生しました');
	}
};
