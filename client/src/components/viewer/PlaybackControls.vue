<script setup lang="ts">
import { computed } from 'vue'
import { usePlaybackStore } from '../../stores/playbackStore.js'

const store = usePlaybackStore()

const progress = computed({
	get: () =>
		store.totalFrames > 0
			? store.currentFrameIndex / (store.totalFrames - 1)
			: 0,
	set: (v: number) =>
		store.seekToFrame(Math.round(v * (store.totalFrames - 1)))
})

const speeds = [0.25, 0.5, 1, 2, 4]
function togglePlay() {
	store.isPlaying ? store.pause() : store.play()
}

function formatTime(ticks: number): string {
	const s = Math.max(0, Math.floor(ticks / store.tickRate))
	const m = Math.floor(s / 60)
	const sec = s % 60
	return `${m}:${sec.toString().padStart(2, '0')}`
}

const elapsed = computed(() => {
	const round = store.currentRound
	if (!round) return 0
	return store.currentTick - round.startTick
})

const duration = computed(() => {
	const round = store.currentRound
	if (!round || store.frames.length === 0) return 0
	return store.frames[store.frames.length - 1].tick - round.startTick
})
</script>

<template>
	<div class="playback-controls pa-3">
		<!-- Scrubber -->
		<v-slider
			v-model="progress"
			:min="0"
			:max="1"
			:step="0"
			hide-details
			color="primary"
			track-color="rgba(255,255,255,0.1)"
			density="compact"
			class="mb-1"
		/>

		<div class="d-flex align-center gap-3">
			<!-- Play/Pause -->
			<v-btn
				:icon="store.isPlaying ? 'mdi-pause' : 'mdi-play'"
				density="compact"
				variant="text"
				color="white"
				@click="togglePlay"
			/>

			<!-- Stop / reset -->
			<v-btn
				icon="mdi-skip-previous"
				density="compact"
				variant="text"
				color="white"
				@click="store.stop"
			/>

			<!-- Time display -->
			<div
				class="text-caption text-medium-emphasis"
				style="min-width: 100px; font-variant-numeric: tabular-nums"
			>
				{{ formatTime(elapsed) }} / {{ formatTime(duration) }}
			</div>

			<v-spacer />

			<!-- Speed picker -->
			<div class="d-flex align-center gap-1">
				<v-btn
					v-for="s in speeds"
					:key="s"
					:color="store.playbackSpeed === s ? 'primary' : undefined"
					:variant="store.playbackSpeed === s ? 'flat' : 'text'"
					density="compact"
					size="x-small"
					@click="store.playbackSpeed = s"
				>
					{{ s }}×
				</v-btn>
			</div>
		</div>
	</div>
</template>

<style scoped>
.playback-controls {
	border-top: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
