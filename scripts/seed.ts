import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// .wrangler/state/v3/d1 以下のどこかにある .sqlite ファイルを探す関数
function findSqliteFile(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // ファイルかつ .sqlite で終わるものを発見したら返す
        if (entry.isFile() && entry.name.endsWith('.sqlite')) {
            return fullPath;
        }
        
        // ディレクトリなら再帰的に探す
        if (entry.isDirectory()) {
            const result = findSqliteFile(fullPath);
            if (result) return result;
        }
    }
    return null;
}

// 探索開始
const d1BasePath = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1');
console.log(`🔍 Searching for SQLite DB in: ${d1BasePath}`);

const dbFile = findSqliteFile(d1BasePath);

if (!dbFile) {
    console.error('❌ ローカルDBファイル (.sqlite) が見つかりませんでした。');
    console.error('ヒント: 先に `bunx wrangler d1 migrations apply atcoder_db --local` が成功しているか確認してください。');
    process.exit(1);
}

console.log(`📂 Connecting to local DB: ${dbFile}`);
const db = new Database(dbFile);

async function main() {
    console.log('🔄 Fetching problems from Kenkoooo API...');
    const response = await fetch('https://kenkoooo.com/atcoder/resources/merged-problems.json');
    if (!response.ok) throw new Error('Failed to fetch problems');
    
    const problems = await response.json();
    console.log(`📦 Downloaded ${problems.length} problems.`);

    // 既存データを削除
    db.run('DELETE FROM problems');
    console.log('🧹 Cleared existing problems.');

    // チャンクに分けて挿入
    const CHUNK_SIZE = 100;
    let insertedCount = 0;

    // ▼▼▼ 修正箇所: submission_status を削除 ▼▼▼
    const insertStmt = db.prepare(`
        INSERT INTO problems (id, contest_id, title, difficulty)
        VALUES ($id, $contest_id, $title, $difficulty)
    `);

    const transaction = db.transaction((chunk: any[]) => {
        for (const p of chunk) {
            insertStmt.run({
                $id: p.id,
                $contest_id: p.contest_id,
                $title: p.title,
                $difficulty: p.difficulty
            });
        }
    });

    for (let i = 0; i < problems.length; i += CHUNK_SIZE) {
        const chunk = problems.slice(i, i + CHUNK_SIZE);
        transaction(chunk);
        insertedCount += chunk.length;
        process.stdout.write(`\r🚀 Inserted: ${insertedCount} / ${problems.length}`);
    }

    console.log('\n✨ Done! All problems inserted.');
}

main().catch(console.error);