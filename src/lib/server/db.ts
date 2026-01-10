import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';

export function getDb(platform: App.Platform | undefined) {
	if (!platform?.env?.atcoder_db) {
		throw new Error(
			'D1 database binding is not available. Make sure you are running with `wrangler dev` or deployed to Cloudflare Workers.'
		);
	}
	return drizzle(platform.env.atcoder_db, { schema });
}
