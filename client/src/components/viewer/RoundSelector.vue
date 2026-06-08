<script setup lang="ts">
import { computed } from 'vue'
import { usePlaybackStore } from '../../stores/playbackStore.js'

const emit = defineEmits<{ selectRound: [roundId: string] }>()
const store = usePlaybackStore()

const selected = computed(() => store.currentRoundId)

function select(id: string) {
	if (id !== selected.value) emit('selectRound', id)
}
</script>

<template>
	<div class="round-selector">
		<div
			v-for="round in store.rounds"
			:key="round.id"
			:class="['round-chip', { active: round.id === selected }]"
			@click="select(round.id)"
		>
			<span class="round-num">{{ round.roundNumber }}</span>
			<v-icon
				v-if="round.winnerTeam === 'CT'"
				size="10"
				color="#82b1ff"
				class="ml-1"
				>mdi-shield-half-full</v-icon
			>
			<v-icon
				v-else-if="round.winnerTeam === 'T'"
				size="10"
				color="#ffcc80"
				class="ml-1"
				>mdi-knife</v-icon
			>
		</div>
	</div>
</template>

<style scoped>
.round-selector {
	display: flex;
	gap: 4px;
	padding: 6px 12px;
	overflow-x: auto;
	scrollbar-width: thin;
}
.round-chip {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 28px;
	height: 28px;
	padding: 0 6px;
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	font-size: 11px;
	font-weight: 700;
	cursor: pointer;
	user-select: none;
	transition:
		background 0.15s,
		border-color 0.15s;
	color: rgba(255, 255, 255, 0.5);
}
.round-chip:hover {
	background: rgba(255, 255, 255, 0.06);
}
.round-chip.active {
	background: rgba(var(--v-theme-primary), 0.2);
	border-color: rgb(var(--v-theme-primary));
	color: #fff;
}
.round-num {
	font-variant-numeric: tabular-nums;
}
</style>
