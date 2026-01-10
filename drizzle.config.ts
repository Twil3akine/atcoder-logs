// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle', // マイグレーションファイルの出力先
	driver: 'd1-http', // D1用
	dialect: 'sqlite',
	// pushを使わないなら、ここはシンプルでOK
} satisfies Config;