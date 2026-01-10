import { getDb } from '$lib/server/db';
import { problems, myNotes } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
	try {
		const db = getDb(platform);
		const problemId = params.problemId;

		// 問題を取得
		const [problem] = await db.select().from(problems).where(eq(problems.id, problemId)).limit(1);

		if (!problem) {
			throw error(404, '問題が見つかりません');
		}

		// ノートを取得
		const [note] = await db
			.select()
			.from(myNotes)
			.where(eq(myNotes.problemId, problemId))
			.limit(1);

		return {
			problem,
			note: note || null
		};
	} catch (err) {
		if (err instanceof Error && err.message.includes('D1 database binding is not available')) {
			throw error(503, 'データベースに接続できません');
		}
		throw err;
	}
};
