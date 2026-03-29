<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { base } from '$app/paths';
	import katex from 'katex';
	import 'katex/dist/katex.css';
	import { invalidateAll } from '$app/navigation';

	import { markedHighlight } from 'marked-highlight';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/github-dark.css';

	// 修正後:
	import { Marked } from 'marked';

	const myMarked = new Marked(
		markedHighlight({
			langPrefix: 'hljs language-',
			highlight(code, lang) {
				const language = hljs.getLanguage(lang) ? lang : 'plaintext';
				return hljs.highlight(code, { language }).value;
			}
		})
	);

	// HTMLが描画された後にコピーボタンをDOMに挿入するSvelteアクション
	function withCopyButton(node: HTMLElement, content: string) {
		function apply() {
			const pres = node.querySelectorAll('pre');
			pres.forEach((pre) => {
				// 既にラッパーがある場合はスキップ
				if (pre.parentElement?.classList.contains('code-wrapper')) return;

				// preタグをdivでラップする
				const wrapper = document.createElement('div');
				wrapper.className = 'code-wrapper relative group';
				pre.parentNode?.insertBefore(wrapper, pre);
				wrapper.appendChild(pre);

				// コピーボタンの生成
				const btn = document.createElement('button');
				btn.className =
					'absolute top-2 right-2 rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-300';
				btn.textContent = 'Copy';

				btn.onclick = async () => {
					const codeText = pre.querySelector('code')?.textContent || pre.textContent || '';
					await navigator.clipboard.writeText(codeText);
					btn.textContent = 'Copied!';
					setTimeout(() => (btn.textContent = 'Copy'), 2000);
				};

				wrapper.appendChild(btn);
			});
		}

		// 初回描画時と更新時に実行
		setTimeout(apply, 0);
		return {
			update() {
				setTimeout(apply, 0);
			}
		};
	}

	export let data: PageData;

	let isAdmin = false;
	let isEditing = false;
	let editContent = '';

	// プレースホルダー（コンパイルエラー回避済み）
	const placeholderText = `# 解説
ここに解説を書いてください...

$$
x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}
$$`;

	$: previewHtml = renderMarkdown(editContent);

	onMount(() => {
		editContent = data.note?.content || '';
		isAdmin = !!localStorage.getItem('admin_key');
	});

	function renderMarkdown(markdown: string): string {
		if (!markdown) return '';
		let rendered = markdown;

		rendered = rendered.replace(/\$\$([\s\S]*?)\$\$/g, (_, equation) => {
			try {
				return katex.renderToString(equation.trim(), { displayMode: true });
			} catch (e) {
				return `<span class="text-red-500">数式エラー: ${e}</span>`;
			}
		});

		rendered = rendered.replace(/\$([^\$]+)\$/g, (_, equation) => {
			try {
				return katex.renderToString(equation.trim(), { displayMode: false });
			} catch (e) {
				return `<span class="text-red-500">数式エラー: ${e}</span>`;
			}
		});

		return myMarked.parse(rendered, { breaks: true }) as string;
	}

	async function saveNote() {
		const adminKey = localStorage.getItem('admin_key') || '';

		const response = await fetch(`${base}/api/problems/${data.problem.id}/note`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-admin-key': adminKey // 【追加】 ヘッダーにキーを含める
			},
			body: JSON.stringify({
				content: editContent,
				hasSolution: data.note?.hasSolution || false, // 解説がある場合は維持
				hasExplanation: true
			})
		});

		if (response.ok) {
			window.location.reload();
		} else {
			alert('保存に失敗しました');
		}
	}

	async function deleteNote() {
		if (!confirm('本当に解説を削除しますか？\nこの操作は取り消せません。')) {
			return;
		}

		try {
			const response = await fetch(`${base}/api/problems/${data.problem.id}/note`, {
				method: 'DELETE',
				headers: {
					'x-admin-key': adminKey
				}
			});

			if (!response.ok) throw new Error('Failed to delete');

			// 成功したらデータを再取得して表示を更新
			await invalidateAll();

			// 入力欄をクリアして編集モードを終了
			editContent = '';
			isEditing = false;
		} catch (error) {
			console.error(error);
			alert('削除に失敗しました。');
		}
	}

	async function toggleSolution() {
		const newStatus = !data.note?.hasSolution;
		const adminKey = localStorage.getItem('admin_key') || '';

		const response = await fetch(`${base}/api/problems/${data.problem.id}/note`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-admin-key': adminKey
			},
			body: JSON.stringify({
				content: data.note?.content || '',
				hasSolution: newStatus,
				hasExplanation: data.note?.hasExplanation || false
			})
		});

		if (response.ok) {
			data.note = { ...data.note, hasSolution: newStatus } as any;
		}
	}

	$: solutionClass =
		data.note?.hasSolution && data.note?.hasExplanation
			? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
			: data.note?.hasSolution
				? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100'
				: 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50';

	$: checkClass =
		data.note?.hasSolution && data.note?.hasExplanation
			? 'border-indigo-500 bg-indigo-500 text-white'
			: data.note?.hasSolution
				? 'border-fuchsia-500 bg-fuchsia-500 text-white'
				: 'border-gray-400 bg-white';
</script>

<div class="container mx-auto w-full max-w-[95%] px-4 py-6">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-4">
		<div>
			<a href="{base}/" class="mb-1 inline-block text-sm text-gray-500 hover:text-gray-800"
				>← 一覧に戻る</a
			>
			<h1 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
				{data.problem.title}
				{#if data.problem.difficulty !== null}
					<span
						class="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 text-sm font-normal text-gray-600"
						>Diff: {data.problem.difficulty}</span
					>
				{/if}
			</h1>
			<a
				href="https://atcoder.jp/contests/{data.problem.contestId}/tasks/{data.problem.id}"
				target="_blank"
				rel="noopener noreferrer"
				class="mt-1 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
			>
				問題ページへ <span class="text-xs">↗</span>
			</a>
		</div>

		<div class="flex items-center gap-3">
			<button
				onclick={toggleSolution}
				class="flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition-all {solutionClass}"
			>
				<div class="flex h-4 w-4 items-center justify-center rounded border text-xs {checkClass}">
					{#if data.note?.hasSolution}✓{/if}
				</div>
				<span class="font-medium">{data.note?.hasSolution ? '解決済み' : '解決済みにする'}</span>
			</button>

			{#if !isEditing}
				{#if data.note?.content}
					{#if isAdmin}
						<button
							onclick={() => (isEditing = true)}
							class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
						>
							解説を編集
						</button>
					{/if}
				{/if}
			{/if}
		</div>
	</div>

	{#if isEditing}
		<div class="grid h-[calc(100vh-140px)] min-h-[600px] grid-cols-1 gap-4 lg:grid-cols-2">
			<div class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-300 shadow-lg">
				<div
					class="flex shrink-0 items-center justify-between bg-slate-800 px-4 py-2 text-sm font-medium text-white"
				>
					<span>Markdown Editor</span>
					<span class="text-xs text-slate-400">TeX対応</span>
				</div>
				<textarea
					bind:value={editContent}
					class="w-full flex-1 resize-none bg-white p-4 font-mono text-sm leading-relaxed focus:bg-slate-50 focus:outline-none"
					placeholder={placeholderText}
				></textarea>

				<div class="flex shrink-0 justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
					<div>
						{#if data.note?.content}
							<button
								onclick={deleteNote}
								class="rounded px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
							>
								削除
							</button>
						{/if}
					</div>

					<div class="flex gap-3">
						<button
							onclick={() => {
								isEditing = false;
								editContent = data.note?.content || '';
							}}
							class="rounded px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
						>
							キャンセル
						</button>
						<button
							onclick={saveNote}
							class="rounded bg-green-600 px-6 py-2 text-sm font-bold text-white shadow transition-colors hover:bg-green-700"
						>
							保存して終了
						</button>
					</div>
				</div>
			</div>

			<div
				class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
			>
				<div
					class="shrink-0 border-b border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
				>
					Preview
				</div>
				<div class="flex-1 overflow-y-auto p-6">
					<div
						class="markdown-content prose max-w-none prose-slate prose-headings:text-gray-900"
						use:withCopyButton={previewHtml}
					>
						{#if editContent}
							{@html previewHtml}
						{:else}
							<div class="flex h-full items-center justify-center text-gray-400 italic">
								プレビューエリア
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{:else if data.note?.content}
		<div class="min-h-[200px] rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
			<div
				class="markdown-content prose prose-xl max-w-none prose-slate prose-headings:text-gray-900"
				use:withCopyButton={data.note.content}
			>
				{@html renderMarkdown(data.note.content)}
			</div>
		</div>
	{:else}
		<div
			class="flex h-[60vh] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50"
		>
			<p class="mb-6 text-lg text-gray-500">まだ解説がありません</p>
			{#if isAdmin}
				<button
					onclick={() => (isEditing = true)}
					class="rounded-lg border border-gray-300 bg-white px-8 py-3 text-lg font-medium text-blue-600 shadow-sm transition-colors hover:bg-blue-50"
				>
					解説を書く
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	:global(.markdown-content) {
		line-height: 1.8;
	}

	/* ▼ コードブロック全体 (黒背景を強制) ▼ */
	:global(.markdown-content.prose pre) {
		margin: 1em 0;
		padding: 1em;
		border-radius: 0.5em;
		background-color: #0d1117 !important; /* GitHub Darkの背景色 */
		color: #c9d1d9 !important; /* GitHub Darkの基本文字色 */
		overflow-x: auto;
	}

	/* ▼ コードブロック内のコード (背景色を透明にしてhighlight.jsに任せる) ▼ */
	:global(.markdown-content.prose pre code.hljs) {
		background-color: transparent !important;
		padding: 0;
		color: inherit;
	}

	/* ▼ インラインコード (文章中の `code` のみ適用) ▼ */
	:global(.markdown-content.prose code:not(.hljs)) {
		background-color: #f1f5f9 !important;
		color: #db2777 !important; /* 少し目立つピンク系の色 */
		padding: 0.2em 0.4em;
		border-radius: 0.25em;
		font-size: 0.9em;
		font-weight: 500;
	}

	:global(.markdown-content .katex-display) {
		margin: 1.5em 0;
		overflow-x: auto;
	}
	:global(.markdown-content blockquote) {
		border-left: 4px solid #3b82f6;
		background-color: #eff6ff;
		padding: 0.5em 1em;
		font-style: normal;
		margin: 1em 0;
		color: #1e3a8a;
	}
	/* リンクの色 */
	:global(.markdown-content a) {
		color: #2563eb;
		text-decoration: underline;
	}
	:global(.markdown-content a:hover) {
		color: #1d4ed8;
	}
</style>
