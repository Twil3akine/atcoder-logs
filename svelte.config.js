import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			compatibilityDate: '2024-01-01',
			compatibilityFlags: ['nodejs_compat']
		}),

		paths: {
			base: '/logs'
		},

		csrf: {
			checkOrigin: false
		}
	},

};

export default config;
