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

	// 問題の状態を取得
	// 0: 無提出（白）、1: AC以外（黄）、2: AC（緑）、3: 解説済み（水色）
	function getProblemStatus(problem: (typeof data.problemsByContest)[string][number]): number {
		// 解説済みが最優先
		if (problem.note?.hasExplanation) return 3; // 解説済み（水色）
		// 提出状況を確認
		if (problem.submissionStatus === 'AC') return 2; // AC（緑）
		if (problem.submissionStatus && problem.submissionStatus !== 'AC') return 1; // AC以外（黄）
		return 0; // 無提出（白）
	}

	// 状態に応じた背景色クラスを取得
	function getStatusClass(status: number): string {
		switch (status) {
			case 3:
				return 'bg-cyan-200 hover:bg-cyan-400'; // 解説済み（水色）
			case 2:
				return 'bg-green-200 hover:bg-green-400'; // AC（緑）
			case 1:
				return 'bg-yellow-200 hover:bg-yellow-400'; // WA（黄）
			default:
				return 'bg-white hover:bg-gray-200'; // 無提出（白）
		}
	}

	// コンテストタイプでフィルタリング
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

	// フィルタリングされたコンテストIDのリスト
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

		<!-- フィルターボタン -->
		<div class="mb-4 flex flex-wrap gap-2">
			<button
				onclick={() => (selectedType = 'ABC')}
				class="rounded-lg px-4 py-2 text-base font-medium transition-colors {selectedType === 'ABC'
					? 'bg-blue-500 text-white'
					: 'bg-white text-gray-700 hover:bg-gray-100'}"
			>
				ABC
			</button>
			<button
				onclick={() => (selectedType = 'ARC')}
				class="rounded-lg px-4 py-2 text-base font-medium transition-colors {selectedType === 'ARC'
					? 'bg-blue-500 text-white'
					: 'bg-white text-gray-700 hover:bg-gray-100'}"
			>
				ARC
			</button>
			<button
				onclick={() => (selectedType = 'AGC')}
				class="rounded-lg px-4 py-2 text-base font-medium transition-colors {selectedType === 'AGC'
					? 'bg-blue-500 text-white'
					: 'bg-white text-gray-700 hover:bg-gray-100'}"
			>
				AGC
			</button>
			<button
				onclick={() => (selectedType = 'AHC')}
				class="rounded-lg px-4 py-2 text-base font-medium transition-colors {selectedType === 'AHC'
					? 'bg-blue-500 text-white'
					: 'bg-white text-gray-700 hover:bg-gray-100'}"
			>
				AHC
			</button>
			<button
				onclick={() => (selectedType = 'Other')}
				class="rounded-lg px-4 py-2 text-base font-medium transition-colors {selectedType ===
				'Other'
					? 'bg-blue-500 text-white'
					: 'bg-white text-gray-700 hover:bg-gray-100'}"
			>
				Other
			</button>
		</div>

		<div class="overflow-hidden rounded-lg bg-white shadow-lg">
			<table class="w-full max-w-full table-fixed border-collapse border border-gray-300 text-base">
				<thead>
					<tr>
						<th
							class="sticky left-0 z-10 border border-gray-300 bg-gray-100 px-4 py-3 text-left text-lg font-bold"
						>
							ID
						</th>
						<th
							class="max-w-[60px] min-w-[60px] border border-gray-300 bg-gray-100 px-1 py-2 text-center text-lg font-bold"
							>A</th
						>
						<th
							class="max-w-[60px] min-w-[60px] border border-gray-300 bg-gray-100 px-1 py-2 text-center text-lg font-bold"
							>B</th
						>
						<th
							class="max-w-[60px] min-w-[60px] border border-gray-300 bg-gray-100 px-1 py-2 text-center text-lg font-bold"
							>C</th
						>
						<th
							class="max-w-[60px] min-w-[60px] border border-gray-300 bg-gray-100 px-1 py-2 text-center text-lg font-bold"
							>D</th
						>
						<th
							class="max-w-[60px] min-w-[60px] border border-gray-300 bg-gray-100 px-1 py-2 text-center text-lg font-bold"
							>E</th
						>
						<th
							class="max-w-[60px] min-w-[60px] border border-gray-300 bg-gray-100 px-1 py-2 text-center text-lg font-bold"
							>F</th
						>
						<th
							class="max-w-[60px] min-w-[60px] border border-gray-300 bg-gray-100 px-1 py-2 text-center text-lg font-bold"
							>G</th
						>
						<th
							class="max-w-[60px] min-w-[60px] border border-gray-300 bg-gray-100 px-1 py-2 text-center text-lg font-bold"
							>H/Ex</th
						>
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
								<td
									class="h-12 max-w-[60px] min-w-[60px] overflow-hidden border border-gray-300 px-1 py-1 text-center transition-colors {getStatusClass(
										status
									)}"
								>
									{#if problem}
										<a
											href="/problems/{problem.id}"
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
