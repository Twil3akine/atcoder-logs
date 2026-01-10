<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	// コンテストIDのリスト（降順：最新が上）
	$: contestIds = Object.keys(data.problemsByContest).sort((a, b) => {
		// ABC形式のコンテストIDを数値で比較（例: ABC439 > ABC001）
		const aMatch = a.match(/(\d+)$/);
		const bMatch = b.match(/(\d+)$/);
		if (aMatch && bMatch) {
			return parseInt(bMatch[1]) - parseInt(aMatch[1]); // 降順
		}
		return b.localeCompare(a); // 文字列として降順
	});

	// 各コンテストの問題を取得する関数
	function getProblemsForContest(contestId: string) {
		return data.problemsByContest[contestId] || [];
	}

	// 問題IDから問題番号を抽出（例: "abc123_a" -> "a"）
	function getProblemNumber(problemId: string, contestId: string): string {
		const prefix = contestId.toLowerCase() + '_';
		if (problemId.toLowerCase().startsWith(prefix)) {
			return problemId.slice(prefix.length).toUpperCase();
		}
		// フォールバック: 問題IDの最後の部分を返す
		const parts = problemId.split('_');
		return parts[parts.length - 1].toUpperCase();
	}


	// 問題の状態を取得（0: 未解答, 1: 解答済み, 2: 解説済み）
	function getProblemStatus(problem: (typeof data.problemsByContest)[string][number]): number {
		if (!problem.note) return 0; // 未解答
		if (problem.note.hasExplanation) return 2; // 解説済み
		if (problem.note.hasSolution) return 1; // 解答済み
		return 0;
	}

	// 状態に応じた背景色クラスを取得
	function getStatusClass(status: number): string {
		switch (status) {
			case 2:
				return 'bg-green-200 hover:bg-green-300'; // 解説済み（緑）
			case 1:
				return 'bg-yellow-200 hover:bg-yellow-300'; // 解答済み（黄）
			default:
				return 'bg-white hover:bg-gray-100'; // 未解答（白）
		}
	}

	let isSeeding = false;
	let seedMessage = '';
	let filterContestId = '';

	async function seedProblems() {
		isSeeding = true;
		seedMessage = 'データを取得中...';
		try {
			const response = await fetch('/api/seed', {
				method: 'POST'
			});
			const result = await response.json();
			if (result.success) {
				seedMessage = `✅ ${result.count}件の問題を投入しました！ページをリロードしてください。`;
				setTimeout(() => {
					window.location.reload();
				}, 2000);
			} else {
				seedMessage = `❌ エラー: ${result.error || '不明なエラー'}`;
			}
		} catch (error) {
			seedMessage = `❌ エラー: ${error instanceof Error ? error.message : '不明なエラー'}`;
		} finally {
			isSeeding = false;
		}
	}

	// フィルタリングされたコンテストIDのリスト（降順を維持）
	$: filteredContestIds = filterContestId
		? contestIds.filter((id) => id.toLowerCase().includes(filterContestId.toLowerCase()))
		: contestIds;
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-6">AtCoder Problems Matrix</h1>
	
	{#if data.error}
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
			<p class="text-yellow-800 font-medium">⚠️ {data.error}</p>
			<p class="text-yellow-700 text-sm mt-2">
				開発サーバーを起動するには、<code class="bg-yellow-100 px-2 py-1 rounded">bun run dev:cf</code> または <code class="bg-yellow-100 px-2 py-1 rounded">wrangler dev</code> を使用してください。
			</p>
		</div>
	{/if}

	<div class="flex items-center justify-between mb-4 gap-4 flex-wrap">
		<p class="text-gray-600">総問題数: {data.totalProblems}</p>
		<div class="flex items-center gap-2">
			<label for="contest-filter" class="text-sm text-gray-600">コンテストID: </label>
			<input
				id="contest-filter"
				type="text"
				bind:value={filterContestId}
				placeholder="例: abc"
				class="px-3 py-1 border border-gray-300 rounded text-sm"
			/>
		</div>
	</div>

	{#if data.totalProblems === 0}
		<div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-center">
			<p class="text-blue-800 font-medium mb-4">データベースに問題データがありません</p>
			<button
				onclick={seedProblems}
				disabled={isSeeding}
				class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
			>
				{isSeeding ? '投入中...' : 'AtCoder Problems APIからデータを投入'}
			</button>
			{#if seedMessage}
				<p class="mt-4 text-sm {seedMessage.includes('✅') ? 'text-green-700' : 'text-red-700'}">
					{seedMessage}
				</p>
			{/if}
		</div>
	{/if}

	<div class="overflow-x-auto">
		<div class="inline-block min-w-full">
			<table class="min-w-full border-collapse border border-gray-300">
				<thead>
					<tr>
						<th class="border border-gray-300 bg-gray-100 px-4 py-2 text-left sticky left-0 z-10">
							コンテストID
						</th>
						<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-center min-w-[80px]">A</th>
						<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-center min-w-[80px]">B</th>
						<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-center min-w-[80px]">C</th>
						<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-center min-w-[80px]">D</th>
						<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-center min-w-[80px]">E</th>
						<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-center min-w-[80px]">F</th>
						<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-center min-w-[80px]">G</th>
						<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-center min-w-[80px]">H/Ex</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredContestIds as contestId}
						<tr class="hover:bg-gray-50">
							<td
								class="border border-gray-300 px-4 py-2 font-medium bg-gray-50 sticky left-0 z-10"
							>
								{contestId}
							</td>
							{#each ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H/Ex'] as problemNum}
								{@const problems = getProblemsForContest(contestId)}
								{@const problem = problems.find((p) => {
									const num = getProblemNumber(p.id, contestId);
									// H/Ex列にはHとExの両方を表示
									if (problemNum === 'H/Ex' && (num === 'H' || num === 'EX')) return true;
									// その他の列は完全一致
									if (problemNum !== 'H/Ex') return num === problemNum;
									return false;
								})}
								{@const status = problem ? getProblemStatus(problem) : -1}
								<td class="border border-gray-300 px-1 py-1 text-center min-w-[80px] h-16">
									{#if problem}
										<a
											href="/problems/{problem.id}"
											class="block w-full h-full px-2 py-2 rounded transition-colors {getStatusClass(status)}"
											title="{problem.title}"
										>
											<div class="text-xs font-semibold mb-1 line-clamp-2 leading-tight">{problem.title}</div>
											{#if problem.difficulty !== null}
												<div class="text-xs text-gray-600">{problem.difficulty}</div>
											{/if}
										</a>
									{:else}
										<div class="w-full h-full"></div>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
