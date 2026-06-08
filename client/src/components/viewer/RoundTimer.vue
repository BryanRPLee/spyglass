<script setup lang="ts">
import { computed } from 'vue'
import { usePlaybackStore } from '../../stores/playbackStore.js'

const BOMB_FUSE_SECONDS = 40

const store = usePlaybackStore()

function formatTime(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds))
	const m = Math.floor(s / 60)
	const sec = s % 60
	return `${m}:${sec.toString().padStart(2, '0')}`
}

const bombSecondsLeft = computed(() => {
	const plant = store.activeBombPlant
	if (!plant) return null
	const elapsed = (store.currentTick - plant.tick) / store.tickRate
	return Math.max(0, BOMB_FUSE_SECONDS - elapsed)
})

const roundElapsedSeconds = computed(() => {
	const round = store.currentRound
	if (!round) return 0
	return Math.max(0, (store.currentTick - round.startTick) / store.tickRate)
})
</script>

<template>
	<div class="round-timer d-flex align-center">
		<template v-if="bombSecondsLeft !== null">
			<v-icon size="14" color="#ff5252" class="mr-1">mdi-bomb</v-icon>
			<span class="timer-value bomb">{{
				formatTime(bombSecondsLeft)
			}}</span>
		</template>
		<template v-else-if="store.currentRound">
			<v-icon size="14" color="blue-grey-lighten-2" class="mr-1"
				>mdi-timer-outline</v-icon
			>
			<span class="timer-value">{{
				formatTime(roundElapsedSeconds)
			}}</span>
		</template>
	</div>
</template>

<style scoped>
.round-timer {
	font-variant-numeric: tabular-nums;
	font-weight: 700;
	font-size: 13px;
	min-width: 64px;
	justify-content: center;
}
.timer-value {
	color: rgba(255, 255, 255, 0.75);
}
.timer-value.bomb {
	color: #ff5252;
	animation: pulse 1s infinite;
}
@keyframes pulse {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.45;
	}
}
</style>
