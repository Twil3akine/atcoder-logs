import { getDb } from '$lib/server/db';
import { seedProblems } from '$lib/server/seed';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ platform }) => {
	try {
		const db = getDb(platform);
		const count = await seedProblems(db);
		return json({ success: true, count });
	} catch (error) {
		console.error('Seed error:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
