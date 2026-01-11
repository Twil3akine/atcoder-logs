import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface AtCoderProblem {
	id: string;
	title: string;
	contest_id: string;
	difficulty?: number;
}

async function seedProduction() {
	try {
		console.log('AtCoder Problems APIからデータを取得中...');
		const response = await fetch('https://kenkoooo.com/atcoder/resources/problems.json');

		if (!response.ok) {
			throw new Error(`Failed to fetch problems: ${response.statusText} (${response.status})`);
		}

		const data: AtCoderProblem[] = await response.json();
		console.log(`${data.length}件の問題データを取得しました`);

		console.log('本番環境データベースに投入中...');

		// SQLファイルを生成
		const sqlFile = join(process.cwd(), 'temp-seed-production.sql');

		// バッチサイズで処理
		const batchSize = 50;
		let totalInserted = 0;
		let sqlContent = '';

		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);

			// SQLのINSERT文を生成（エスケープ処理）
			const values = batch
				.map((p) => {
					const id = p.id.replace(/'/g, "''");
					const title = p.title.replace(/'/g, "''");
					const contestId = p.contest_id.replace(/'/g, "''");
					const difficulty = p.difficulty !== undefined ? p.difficulty : 'NULL';
					return `('${id}', '${title}', '${contestId}', ${difficulty})`;
				})
				.join(',\n  ');

			sqlContent += `INSERT OR IGNORE INTO problems (id, title, contest_id, difficulty) VALUES\n  ${values};\n\n`;
		}

		// SQLファイルに書き込み
		writeFileSync(sqlFile, sqlContent, 'utf-8');
		console.log(`SQLファイルを生成しました: ${sqlFile}`);

		// wrangler d1 executeを使ってリモートで実行
		console.log('本番環境データベースに投入中...');
		try {
			execSync(`wrangler d1 execute atcoder-db --remote --file="${sqlFile}"`, {
				stdio: 'inherit' as any,
				shell: true,
				cwd: process.cwd()
			});
			totalInserted = data.length;
			console.log(`✅ 本番環境に ${totalInserted}件の問題を投入しました！`);
		} catch (error) {
			console.error('❌ wranglerコマンドの実行に失敗しました:', error);
			throw error;
		} finally {
			// 一時SQLファイルを削除
			if (existsSync(sqlFile)) {
				unlinkSync(sqlFile);
			}
		}
	} catch (error) {
		console.error('❌ エラー:', error);
		process.exit(1);
	}
}

seedProduction();
