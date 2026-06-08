<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '../api/client.js'
import { usePlaybackStore } from '../stores/playbackStore.js'
import MapCanvas from '../components/viewer/MapCanvas.vue'
import PlaybackControls from '../components/viewer/PlaybackControls.vue'
import RoundSelector from '../components/viewer/RoundSelector.vue'
import KillFeed from '../components/viewer/KillFeed.vue'
import RoundTimer from '../components/viewer/RoundTimer.vue'
import ScoreBoard from '../components/viewer/ScoreBoard.vue'
import TeamHud from '../components/viewer/TeamHud.vue'
import type { DemoSummary } from '../types/demo.js'

const route = useRoute()
const api = useApi()
const store = usePlaybackStore()

const demoId = route.params.id as string
const demo = ref<DemoSummary | null>(null)
const pageLoading = ref(true)
const roundLoading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
	try {
		demo.value = await api.demos.get(demoId)
		if (demo.value.status !== 'READY') {
			error.value =
				'Demo is not ready yet. Go back and wait for parsing to complete.'
			return
		}

		store.demoId = demoId
		store.mapName = demo.value.mapName
		store.tickRate = demo.value.tickRate

		store.rounds = await api.demos.getRounds(demoId)

		if (store.rounds.length > 0) {
			await loadRound(store.rounds[0].id)
		}
	} catch (e) {
		error.value = String(e)
	} finally {
		pageLoading.value = false
	}
})

async function loadRound(roundId: string) {
	roundLoading.value = true
	store.stop()
	try {
		const data = await api.demos.getRoundData(demoId, roundId)
		store.loadRoundData(data)
	} catch (e) {
		error.value = String(e)
	} finally {
		roundLoading.value = false
	}
}
</script>

<template>
	<div class="viewer-root">
		<div
			v-if="pageLoading"
			class="d-flex align-center justify-center"
			style="height: 100vh"
		>
			<v-progress-circular indeterminate color="primary" size="48" />
		</div>

		<div
			v-else-if="error"
			class="d-flex align-center justify-center pa-8"
			style="height: 100vh"
		>
			<v-alert type="error" max-width="480">{{ error }}</v-alert>
		</div>

		<template v-else>
			<div class="viewer-topbar d-flex align-center px-4">
				<v-btn
					icon="mdi-arrow-left"
					variant="text"
					size="small"
					to="/dashboard"
					class="mr-3"
				/>
				<div
					class="text-body-2 font-weight-medium text-truncate mr-4"
					style="max-width: 300px"
				>
					{{ demo?.filename }}
				</div>
				<v-chip
					size="x-small"
					color="blue-grey"
					variant="tonal"
					class="mr-auto text-uppercase"
				>
					{{ demo?.mapName }}
				</v-chip>
				<ScoreBoard class="mr-4" />
				<RoundTimer />
			</div>

			<div class="viewer-body">
				<div class="viewer-hud viewer-hud-t">
					<TeamHud team="T" />
				</div>

				<div class="viewer-map d-flex align-center justify-center">
					<div
						v-if="roundLoading"
						class="map-overlay d-flex align-center justify-center"
					>
						<v-progress-circular indeterminate color="primary" />
					</div>
					<MapCanvas />

					<div
						v-if="store.killsUpToNow.length > 0"
						class="kill-feed-overlay"
					>
						<KillFeed />
					</div>
				</div>

				<div class="viewer-hud viewer-hud-ct">
					<TeamHud team="CT" />
				</div>
			</div>

			<div class="viewer-bottom">
				<div
					class="text-caption font-weight-bold text-medium-emphasis px-3 pt-2"
				>
					ROUNDS
				</div>
				<RoundSelector @select-round="loadRound" />
				<PlaybackControls />
			</div>
		</template>
	</div>
</template>

<style scoped>
.viewer-root {
	display: flex;
	flex-direction: column;
	/* This route always requires auth, so the 52px v-app-bar is always present;
	   v-main's `min-height: 100vh` stacks on top of its app-bar padding, so we
	   must subtract that bar height here or the bottom (playback controls)
	   gets pushed below the fold and the page scrolls. */
	height: calc(100vh - 52px);
	overflow: hidden;
	background: #0d0d1a;
}
.viewer-topbar {
	height: 48px;
	flex-shrink: 0;
	background: #12122a;
	border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	gap: 8px;
}
.viewer-body {
	flex: 1;
	display: flex;
	overflow: hidden;
}
.viewer-map {
	flex: 1;
	position: relative;
	background: #0d0d1a;
	overflow: hidden;
}
.map-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.55);
	z-index: 10;
}
.kill-feed-overlay {
	position: absolute;
	top: 12px;
	right: 12px;
	width: 220px;
	max-height: 45%;
	overflow-y: auto;
	background: rgba(18, 18, 42, 0.78);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 6px;
	backdrop-filter: blur(2px);
}
.viewer-hud {
	width: 200px;
	flex-shrink: 0;
	background: #12122a;
	overflow-y: auto;
}
.viewer-hud-t {
	border-right: 1px solid rgba(255, 255, 255, 0.07);
}
.viewer-hud-ct {
	border-left: 1px solid rgba(255, 255, 255, 0.07);
}
.viewer-bottom {
	flex-shrink: 0;
	background: #12122a;
	border-top: 1px solid rgba(255, 255, 255, 0.07);
}
</style>
