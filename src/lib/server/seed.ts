import { drizzle } from 'drizzle-orm/d1';
import { problems } from './db/schema';
import * as schema from './db/schema';

interface AtCoderProblem {
	id: string;
	title: string;
	contest_id: string;
	difficulty?: number;
}

export async function seedProblems(db: ReturnType<typeof drizzle>) {
	try {
		// Cloudflare Workers環境での外部APIアクセス
		const response = await fetch('https://kenkoooo.com/atcoder/resources/problems.json', {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
			},
			// Cloudflare Workers特有の設定
			cf: {
				cacheTtl: 3600,
				cacheEverything: false
			}
		});

		if (!response.ok) {
			// レスポンスボディを取得してより詳細なエラー情報を提供
			let errorMessage = `Failed to fetch problems: ${response.statusText} (${response.status})`;
			try {
				const text = await response.text();
				if (text) {
					errorMessage += ` - ${text.substring(0, 200)}`;
				}
			} catch (e) {
				// レスポンスボディの読み取りに失敗した場合は無視
			}
			throw new Error(errorMessage);
		}

		const data: AtCoderProblem[] = await response.json();

		// バッチ処理でUpsert（on conflict do nothing）
		const batchSize = 100;
		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);
			await db
				.insert(schema.problems)
				.values(
					batch.map((p) => ({
						id: p.id,
						title: p.title,
						contestId: p.contest_id,
						difficulty: p.difficulty ?? null
					}))
				)
				.onConflictDoNothing();
		}

		console.log(`Seeded ${data.length} problems`);
		return data.length;
	} catch (error) {
		console.error('Error seeding problems:', error);
		throw error;
	}
}
