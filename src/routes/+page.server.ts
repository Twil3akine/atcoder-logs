import { getDb } from '$lib/server/db';
import { problems, myNotes } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	try {
		const db = getDb(platform);
		const allProblems = await db.select().from(problems);
		const allNotes = await db.select().from(myNotes);

		// ノートをproblemIdでマップ
		const notesMap = new Map(allNotes.map((note) => [note.problemId, note]));

		// 問題にノート情報を追加
		const problemsWithNotes = allProblems.map((problem) => ({
			...problem,
			note: notesMap.get(problem.id)
		}));

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
			problemsByContest,
			totalProblems: allProblems.length
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
