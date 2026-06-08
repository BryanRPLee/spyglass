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
			<!-- Transport -->
			<div class="transport d-flex align-center">
				<v-btn
					icon="mdi-skip-previous"
					density="comfortable"
					variant="text"
					color="white"
					size="small"
					@click="store.stop"
				/>
				<v-btn
					:icon="store.isPlaying ? 'mdi-pause' : 'mdi-play'"
					density="comfortable"
					variant="flat"
					color="primary"
					size="default"
					class="play-btn mx-1"
					@click="togglePlay"
				/>
			</div>

			<!-- Time display -->
			<div class="time-display text-caption">
				<span class="text-white">{{ formatTime(elapsed) }}</span>
				<span class="text-medium-emphasis"> / {{ formatTime(duration) }}</span>
			</div>

			<v-spacer />

			<!-- Speed picker -->
			<div class="speed-picker d-flex align-center">
				<button
					v-for="s in speeds"
					:key="s"
					:class="['speed-btn', { active: store.playbackSpeed === s }]"
					@click="store.playbackSpeed = s"
				>
					{{ s }}×
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
.playback-controls {
	border-top: 1px solid rgba(255, 255, 255, 0.06);
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent);
}
.transport {
	background: rgba(255, 255, 255, 0.04);
	border-radius: 999px;
	padding: 2px;
}
.play-btn {
	box-shadow: 0 2px 10px rgba(var(--v-theme-primary), 0.45);
}
.time-display {
	min-width: 100px;
	font-variant-numeric: tabular-nums;
	letter-spacing: 0.3px;
}
.speed-picker {
	gap: 2px;
	background: rgba(255, 255, 255, 0.04);
	border-radius: 999px;
	padding: 3px;
}
.speed-btn {
	border: none;
	background: transparent;
	color: rgba(255, 255, 255, 0.5);
	font-size: 11px;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
	border-radius: 999px;
	padding: 4px 10px;
	cursor: pointer;
	transition:
		background 0.15s,
		color 0.15s;
}
.speed-btn:hover {
	color: rgba(255, 255, 255, 0.85);
}
.speed-btn.active {
	background: rgb(var(--v-theme-primary));
	color: #fff;
}
</style>
