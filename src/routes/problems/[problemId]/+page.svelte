<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { marked } from 'marked';
	import katex from 'katex';
	import 'katex/dist/katex.css';

	export let data: PageData;

	let htmlContent = '';
	let isEditing = false;
	let editContent = '';

	onMount(() => {
		if (data.note?.content) {
			htmlContent = renderMarkdown(data.note.content);
			editContent = data.note.content;
		}
	});

	function renderMarkdown(markdown: string): string {
		// KaTeXの数式をレンダリング
		let rendered = markdown;

		// ブロック数式（$$...$$）
		rendered = rendered.replace(/\$\$([\s\S]*?)\$\$/g, (_, equation) => {
			try {
				return katex.renderToString(equation.trim(), { displayMode: true });
			} catch (e) {
				return `<span class="text-red-500">数式エラー: ${e}</span>`;
			}
		});

		// インライン数式（$...$）
		rendered = rendered.replace(/\$([^\$]+)\$/g, (_, equation) => {
			try {
				return katex.renderToString(equation.trim(), { displayMode: false });
			} catch (e) {
				return `<span class="text-red-500">数式エラー: ${e}</span>`;
			}
		});

		// MarkdownをHTMLに変換
		return marked(rendered, { breaks: true });
	}

	async function saveNote() {
		const response = await fetch(`/api/problems/${data.problem.id}/note`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: editContent,
				hasSolution: true,
				hasExplanation: true
			})
		});

		if (response.ok) {
			const result = await response.json();
			htmlContent = renderMarkdown(editContent);
			isEditing = false;
			// ページをリロードして最新の状態を取得
			window.location.reload();
		} else {
			alert('保存に失敗しました');
		}
	}

	async function toggleSolution() {
		const response = await fetch(`/api/problems/${data.problem.id}/note`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: data.note?.content || '',
				hasSolution: !data.note?.hasSolution,
				hasExplanation: data.note?.hasExplanation || false
			})
		});

		if (response.ok) {
			window.location.reload();
		}
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<div class="mb-6">
		<a href="/" class="text-blue-600 hover:text-blue-800">← 一覧に戻る</a>
	</div>

	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<h1 class="text-3xl font-bold mb-4">{data.problem.title}</h1>
		<div class="flex items-center gap-4 mb-4">
			<a
				href="https://atcoder.jp/contests/{data.problem.contestId}/tasks/{data.problem.id}"
				target="_blank"
				rel="noopener noreferrer"
				class="text-blue-600 hover:text-blue-800"
			>
				問題ページを開く →
			</a>
			{#if data.problem.difficulty !== null}
				<span class="text-gray-600">難易度: {data.problem.difficulty}</span>
			{/if}
		</div>

		<div class="flex gap-2 mb-4">
			<button
				onclick={toggleSolution}
				class="px-4 py-2 rounded {data.note?.hasSolution
					? 'bg-yellow-200 text-yellow-800'
					: 'bg-gray-200 text-gray-600'} hover:opacity-80"
			>
				{data.note?.hasSolution ? '✓ 解答済み' : '未解答'}
			</button>
			<button
				onclick={() => (isEditing = true)}
				class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
			>
				{data.note ? '解説を編集' : '解説を追加'}
			</button>
		</div>
	</div>

	{#if isEditing}
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-2xl font-bold mb-4">解説を編集</h2>
			<textarea
				bind:value={editContent}
				class="w-full h-96 p-4 border border-gray-300 rounded font-mono text-sm"
				placeholder="Markdown形式で解説を記述してください。数式は $...$ (インライン) または $$...$$ (ブロック) で記述できます。"
			></textarea>
			<div class="flex gap-2 mt-4">
				<button
					onclick={saveNote}
					class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
				>
					保存
				</button>
				<button
					onclick={() => {
						isEditing = false;
						editContent = data.note?.content || '';
					}}
					class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
				>
					キャンセル
				</button>
			</div>
		</div>
	{/if}

	{#if htmlContent}
		<div class="bg-white rounded-lg shadow-md p-6">
			<h2 class="text-2xl font-bold mb-4">解説</h2>
			<div
				class="prose prose-slate max-w-none markdown-content prose-headings:text-gray-900 prose-p:text-gray-700 prose-code:text-pink-600"
			>
				{@html htmlContent}
			</div>
		</div>
	{:else if !isEditing}
		<div class="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
			解説がまだありません。「解説を追加」ボタンから解説を追加してください。
		</div>
	{/if}
</div>

<style>
	:global(.markdown-content) {
		line-height: 1.8;
	}

	:global(.markdown-content pre) {
		background-color: #f5f5f5;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
	}

	:global(.markdown-content code) {
		background-color: #f5f5f5;
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.9em;
	}

	:global(.markdown-content pre code) {
		background-color: transparent;
		padding: 0;
	}

	:global(.markdown-content .katex-display) {
		margin: 1.5rem 0;
		overflow-x: auto;
		overflow-y: hidden;
	}
</style>
