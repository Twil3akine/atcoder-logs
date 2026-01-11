import { getDb } from '$lib/server/db';
import { seedProblems } from '$lib/server/seed';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ platform, request }) => {
	// Cron Job認証（シークレットキーで保護）
	const authHeader = request.headers.get('Authorization');
	const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

	if (authHeader !== expectedAuth) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDb(platform);
		const count = await seedProblems(db);

		console.log(`Weekly seed completed: ${count} problems processed`);

		return json({
			success: true,
			count,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Weekly seed error:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

// Cron Job用のスケジュール設定
export const config = {
	schedule: '0 2 * * 1' // 毎週月曜日午前2時（UTC）
};
