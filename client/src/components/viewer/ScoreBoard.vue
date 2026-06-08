<script setup lang="ts">
import { computed } from 'vue'
import { usePlaybackStore } from '../../stores/playbackStore.js'

// CS2 competitive defaults to MR12 (24 regulation rounds, 12 per side) —
// sides swap once the first half ends, i.e. starting round 13. Matches that
// reach overtime swap again every 3 rounds (MR3 OT), but a single top-of-
// screen score readout doesn't need to track those extra OT flips.
const HALFTIME_ROUND = 13

// Matches the T/CT palette used on the radar (MapCanvas) — lighter stroke
// tones read better as text on the dark topbar background.
const CT_COLOR = '#82b1ff'
const T_COLOR = '#ffcc80'

const store = usePlaybackStore()

// Team A/B are tracked by the side they started the match on (not by their
// current side), so each team's tally stays attached to it across the
// halftime swap instead of jumping from one number to the other.
const score = computed(() => {
	const upToRound = store.currentRound?.roundNumber ?? 0
	let teamA = 0 // started on T (left HUD panel)
	let teamB = 0 // started on CT (right HUD panel)

	for (const round of store.rounds) {
		if (round.roundNumber >= upToRound || !round.winnerTeam) continue
		const swapped = round.roundNumber >= HALFTIME_ROUND
		const teamASide = swapped ? 'CT' : 'T'
		if (round.winnerTeam === teamASide) teamA++
		else teamB++
	}

	const swapped = upToRound >= HALFTIME_ROUND
	return {
		teamA,
		teamB,
		teamAColor: swapped ? CT_COLOR : T_COLOR,
		teamBColor: swapped ? T_COLOR : CT_COLOR
	}
})
</script>

<template>
	<div v-if="store.currentRound" class="scoreboard d-flex align-center">
		<span class="score-value" :style="{ color: score.teamAColor }">{{
			score.teamA
		}}</span>
		<span class="score-sep">–</span>
		<span class="score-value" :style="{ color: score.teamBColor }">{{
			score.teamB
		}}</span>
	</div>
</template>

<style scoped>
.scoreboard {
	font-variant-numeric: tabular-nums;
	font-weight: 700;
	font-size: 15px;
	gap: 6px;
}
.score-sep {
	color: rgba(255, 255, 255, 0.4);
}
</style>
