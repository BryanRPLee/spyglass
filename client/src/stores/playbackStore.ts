import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
	RoundSummary,
	RoundData,
	TickFrame,
	RoundEvents
} from '../types/demo.js'

export const usePlaybackStore = defineStore('playback', () => {
	const demoId = ref<string | null>(null)
	const mapName = ref<string>('')
	const tickRate = ref(64)
	const rounds = ref<RoundSummary[]>([])

	const currentRoundId = ref<string | null>(null)
	const frames = ref<TickFrame[]>([])
	const events = ref<RoundEvents>({
		kills: [],
		bombEvents: [],
		shots: [],
		blinds: []
	})

	const currentFrameIndex = ref(0)
	const isPlaying = ref(false)
	const playbackSpeed = ref(1)

	// Continuously-updating precise tick (float, between sampled frames) — lets
	// the map renderer interpolate smooth motion instead of snapping every TICK_STRIDE ticks.
	const playbackProgress = ref(0)

	let rafId: number | null = null
	let lastTimestamp: number | null = null
	let msElapsedSincePlay = 0
	let tickAtPlayStart = 0

	const currentFrame = computed<TickFrame | null>(
		() => frames.value[currentFrameIndex.value] ?? null
	)
	const totalFrames = computed(() => frames.value.length)
	const currentTick = computed(() => currentFrame.value?.tick ?? 0)
	const currentRound = computed(
		() => rounds.value.find((r) => r.id === currentRoundId.value) ?? null
	)

	const killsUpToNow = computed(() => {
		const tick = currentTick.value
		return events.value.kills.filter((k) => k.tick <= tick)
	})

	const activeBombPlant = computed(() => {
		const tick = currentTick.value
		return (
			events.value.bombEvents.find(
				(b) => b.type === 'planted' && b.tick <= tick
			) ?? null
		)
	})

	function loadRoundData(data: RoundData) {
		stop()
		currentRoundId.value = data.id
		frames.value = data.frames
		events.value = data.events
		currentFrameIndex.value = 0
		playbackProgress.value = data.frames[0]?.tick ?? 0
	}

	function play() {
		if (totalFrames.value === 0) return
		if (currentFrameIndex.value >= totalFrames.value - 1)
			currentFrameIndex.value = 0
		isPlaying.value = true
		lastTimestamp = null
		msElapsedSincePlay = 0
		tickAtPlayStart = currentFrame.value!.tick
		rafId = requestAnimationFrame(animate)
	}

	function pause() {
		isPlaying.value = false
		if (rafId !== null) {
			cancelAnimationFrame(rafId)
			rafId = null
		}
		playbackProgress.value = currentFrame.value?.tick ?? 0
	}

	function stop() {
		pause()
		currentFrameIndex.value = 0
		playbackProgress.value = currentFrame.value?.tick ?? 0
	}

	function seekToFrame(index: number) {
		currentFrameIndex.value = Math.max(
			0,
			Math.min(index, totalFrames.value - 1)
		)
		playbackProgress.value = currentFrame.value?.tick ?? 0
		if (isPlaying.value) {
			msElapsedSincePlay = 0
			tickAtPlayStart = currentFrame.value?.tick ?? 0
		}
	}

	function animate(ts: number) {
		if (!isPlaying.value) return

		if (lastTimestamp === null) {
			lastTimestamp = ts
			rafId = requestAnimationFrame(animate)
			return
		}

		msElapsedSincePlay += (ts - lastTimestamp) * playbackSpeed.value
		lastTimestamp = ts

		const msPerTick = 1000 / tickRate.value
		const preciseTick = tickAtPlayStart + msElapsedSincePlay / msPerTick
		const lastTick =
			frames.value[frames.value.length - 1]?.tick ?? preciseTick
		playbackProgress.value = Math.min(preciseTick, lastTick)

		const targetTick = Math.floor(preciseTick)

		if (targetTick > currentFrame.value!.tick) {
			let idx = currentFrameIndex.value
			while (
				idx < frames.value.length - 1 &&
				frames.value[idx + 1].tick <= targetTick
			) {
				idx++
			}

			if (idx >= frames.value.length - 1) {
				currentFrameIndex.value = frames.value.length - 1
				isPlaying.value = false
				return
			}

			currentFrameIndex.value = idx
		}

		rafId = requestAnimationFrame(animate)
	}

	return {
		demoId,
		mapName,
		tickRate,
		rounds,
		currentRoundId,
		frames,
		events,
		currentFrameIndex,
		isPlaying,
		playbackSpeed,
		playbackProgress,
		currentFrame,
		totalFrames,
		currentTick,
		currentRound,
		killsUpToNow,
		activeBombPlant,
		loadRoundData,
		play,
		pause,
		stop,
		seekToFrame
	}
})
