import { getDb } from '$lib/server/db';
import { myNotes } from '$lib/server/db/schema';
import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, platform, request }) => {
	try {
		const db = getDb(platform);
		const problemId = params.problemId;

		if (!problemId) {
			throw error(400, '問題IDが必要です');
		}

		const body = await request.json();
		const { content, hasSolution, hasExplanation } = body;

		if (typeof content !== 'string') {
			throw error(400, 'contentは文字列である必要があります');
		}

		const now = new Date();

		// Upsert（存在すれば更新、なければ作成）
		await db
			.insert(myNotes)
			.values({
				problemId,
				content,
				hasSolution: hasSolution === true,
				hasExplanation: hasExplanation === true,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: myNotes.problemId,
				set: {
					content,
					hasSolution: hasSolution === true,
					hasExplanation: hasExplanation === true,
					updatedAt: now
				}
			});

		return json({ success: true });
	} catch (err) {
		if (err instanceof Error && err.message.includes('D1 database binding is not available')) {
			throw error(503, 'データベースに接続できません');
		}
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, '保存に失敗しました');
	}
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	try {
		const db = getDb(platform);
		const problemId = params.problemId;

		if (!problemId) {
			throw error(400, '問題IDが必要です');
		}

		// 削除実行
		await db.delete(myNotes).where(eq(myNotes.problemId, problemId));

		return json({ success: true });
	} catch (err) {
		// エラーハンドリング
		if (err instanceof Error && err.message.includes('D1 database binding is not available')) {
			throw error(503, 'データベースに接続できません');
		}
		console.error('Failed to delete note:', err);
		throw error(500, '削除に失敗しました');
	}
};