<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';

	export let data: PageData;

	// サーバーから渡されたソート済みIDを使用
	$: contestIds = data.sortedContestIds || [];

	// problemsGridの型定義（data.problemsGridが存在する前提）
	type ProblemType = NonNullable<(typeof data.problemsGrid)[string][string]>;

	function getProblemStatus(problem: ProblemType): number {
		if (problem.note?.hasExplanation) return 3;
		if (problem.submissionStatus === 'AC') return 2;
		if (problem.submissionStatus && problem.submissionStatus !== 'AC') return 1;
		return 0;
	}

	function getStatusClass(status: number): string {
		switch (status) {
			case 3:
				return 'bg-cyan-200 hover:bg-cyan-400';
			case 2:
				return 'bg-green-200 hover:bg-green-400';
			case 1:
				return 'bg-yellow-200 hover:bg-yellow-400';
			default:
				return 'bg-white hover:bg-gray-200';
		}
	}

	type ContestType = 'ABC' | 'ARC' | 'AGC' | 'AHC' | 'Other';
	let selectedType: ContestType = 'ABC';

	function getContestType(contestId: string): ContestType {
		const upper = contestId.toUpperCase();
		if (upper.startsWith('ABC')) return 'ABC';
		if (upper.startsWith('ARC')) return 'ARC';
		if (upper.startsWith('AGC')) return 'AGC';
		if (upper.startsWith('AHC')) return 'AHC';
		return 'Other';
	}

	$: filteredContestIds = contestIds.filter((id) => {
		return getContestType(id) === selectedType;
	});
</script>

<div class="min-h-screen w-full overflow-x-hidden bg-gray-100 p-2">
	<div class="mx-auto w-9/10">
		<h1 class="mb-6 text-4xl font-bold text-gray-900">Twil3akine's Logs</h1>

		{#if data.error}
			<div class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
				<p class="text-lg font-medium text-yellow-800">⚠️ {data.error}</p>
				<p class="mt-2 text-base text-yellow-700">
					開発サーバーを起動するには、<code class="rounded bg-yellow-100 px-2 py-1"
						>bun run dev:cf</code
					> を使用してください。
				</p>
			</div>
		{/if}

		<div class="mb-4 flex flex-wrap gap-2">
			{#each ['ABC', 'ARC', 'AGC', 'AHC', 'Other'] as type}
				<button
					onclick={() => (selectedType = type as ContestType)}
					class="rounded-lg px-4 py-2 text-base font-medium transition-colors {selectedType === type
						? 'bg-blue-500 text-white'
						: 'bg-white text-gray-700 hover:bg-gray-100'}"
				>
					{type}
				</button>
			{/each}
		</div>

		<div class="overflow-hidden rounded-lg bg-white shadow-lg">
			<table class="w-full max-w-full table-fixed border-collapse border border-gray-300 text-base">
				<thead>
					<tr>
						<th
							class="sticky left-0 z-10 border border-gray-300 bg-gray-100 px-4 py-3 text-left text-lg font-bold"
							>ID</th
						>
						{#each ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H/Ex'] as label}
							<th
								class="max-w-[60px] min-w-[60px] border border-gray-300 bg-gray-100 px-1 py-2 text-center text-lg font-bold"
								>{label}</th
							>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each filteredContestIds as contestId}
						<tr>
							<td
								class="sticky left-0 z-10 max-w-[60px] overflow-hidden border border-gray-300 bg-gray-50 px-4 py-3 text-lg font-semibold"
							>
								{contestId.toUpperCase()}
							</td>
							{#each ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H/Ex'] as problemNum}
								{@const colKey = problemNum === 'H/Ex' ? 'H' : problemNum}

								{@const problem = data.problemsGrid?.[contestId]?.[colKey]}
								{@const status = problem ? getProblemStatus(problem) : -1}

								<td
									class="h-12 max-w-[60px] min-w-[60px] overflow-hidden border border-gray-300 px-1 py-1 text-center transition-colors {getStatusClass(
										status
									)}"
								>
									{#if problem}
										<a
											href="{base}/problems/{problem.id}"
											class="flex h-full w-full items-center justify-start px-1 py-1"
											title={problem.submissionStatus
												? `${problem.title} - Status: ${problem.submissionStatus}`
												: problem.title}
										>
											<div
												class="truncate text-left text-base leading-none font-semibold whitespace-nowrap"
											>
												{problem.title}
											</div>
											{#if problem.difficulty !== null}
												<div class="text-left text-base leading-none font-medium text-gray-600">
													{problem.difficulty}
												</div>
											{/if}
											{#if problem.submissionStatus && problem.submissionStatus !== 'AC'}
												<div class="text-left text-xs leading-none font-medium text-orange-600">
													{problem.submissionStatus}
												</div>
											{/if}
										</a>
									{:else}
										<div class="h-full w-full"></div>
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
