<script setup lang="ts">
import { computed } from 'vue'
import { usePlaybackStore } from '../../stores/playbackStore.js'
import { spriteStyle } from '../../data/weaponIcons.js'
import type { BombEvent, KillEvent } from '../../types/demo.js'

const store = usePlaybackStore()

const ICON_HEIGHT = 13
const defuseKitStyle = spriteStyle('defuseKit', ICON_HEIGHT)

// Round span the markers are plotted against — startTick..lastFrameTick, same
// axis PlaybackControls uses for its scrubber so the two stay aligned.
const startTick = computed(() => store.currentRound?.startTick ?? 0)
const endTick = computed(() => {
	const round = store.currentRound
	const lastFrame = store.frames[store.frames.length - 1]
	if (!round) return 0
	return Math.max(lastFrame?.tick ?? round.endTick, round.startTick + 1)
})
const span = computed(() => Math.max(1, endTick.value - startTick.value))

function pct(tick: number): number {
	return Math.min(100, Math.max(0, ((tick - startTick.value) / span.value) * 100))
}

interface KillMarker extends KillEvent {
	left: number
}
const killMarkers = computed<KillMarker[]>(() =>
	store.events.kills.map((k) => ({ ...k, left: pct(k.tick) }))
)

interface BombMarker {
	event: BombEvent
	left: number
}
const bombMarkers = computed<BombMarker[]>(() =>
	store.events.bombEvents
		.filter((b) => b.type === 'planted' || b.type === 'defused')
		.map((event) => ({ event, left: pct(event.tick) }))
)

interface PlantedBand {
	left: number
	width: number
}
// One band per plant, spanning until it's defused/exploded (or the round ends
// with the bomb still live) — the stretch where a CT push or T retake is on.
const plantedBands = computed<PlantedBand[]>(() => {
	const events = store.events.bombEvents
	const bands: PlantedBand[] = []
	for (const plant of events.filter((b) => b.type === 'planted')) {
		const resolved = events.find(
			(b) => b.tick > plant.tick && (b.type === 'defused' || b.type === 'exploded')
		)
		const bandEnd = resolved?.tick ?? endTick.value
		const left = pct(plant.tick)
		bands.push({ left, width: Math.max(0.5, pct(bandEnd) - left) })
	}
	return bands
})

function killLabel(k: KillEvent): string {
	const hs = k.headshot ? ' (headshot)' : ''
	return `${k.attackerName} killed ${k.victimName} — ${k.weapon}${hs}`
}

function bombLabel(b: BombEvent): string {
	if (b.type === 'planted') return `Bomb planted${b.site ? ` — site ${b.site}` : ''}`
	return `Bomb defused${b.site ? ` — site ${b.site}` : ''}`
}
</script>

<template>
	<div class="event-timeline">
		<div class="track">
			<div
				v-for="(band, i) in plantedBands"
				:key="`band-${i}`"
				class="planted-band"
				:style="{ left: `${band.left}%`, width: `${band.width}%` }"
			/>

			<div
				v-for="(kill, i) in killMarkers"
				:key="`kill-${kill.tick}-${i}`"
				class="marker kill-marker"
				:style="{ left: `${kill.left}%` }"
			>
				<v-icon
					:icon="kill.headshot ? 'mdi-skull' : 'mdi-target'"
					size="14"
					:color="kill.attackerTeam === 'CT' ? 'blue-lighten-1' : 'orange-lighten-1'"
				/>
				<v-tooltip activator="parent" location="top">{{ killLabel(kill) }}</v-tooltip>
			</div>

			<div
				v-for="(bomb, i) in bombMarkers"
				:key="`bomb-${bomb.event.tick}-${i}`"
				class="marker bomb-marker"
				:style="{ left: `${bomb.left}%` }"
			>
				<v-icon v-if="bomb.event.type === 'planted'" icon="mdi-bomb" size="14" color="red-lighten-1" />
				<span v-else class="icon-sprite" :style="defuseKitStyle!" />
				<v-tooltip activator="parent" location="top">{{ bombLabel(bomb.event) }}</v-tooltip>
			</div>
		</div>
	</div>
</template>

<style scoped>
.event-timeline {
	padding: 0 2px;
}
.track {
	position: relative;
	height: 22px;
}
.planted-band {
	position: absolute;
	top: 0;
	bottom: 0;
	background: rgba(229, 57, 53, 0.22);
	border-left: 1px solid rgba(229, 57, 53, 0.6);
	border-right: 1px solid rgba(229, 57, 53, 0.6);
	border-radius: 2px;
}
.marker {
	position: absolute;
	top: 50%;
	transform: translate(-50%, -50%);
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: default;
}
.icon-sprite {
	display: inline-block;
	flex-shrink: 0;
	filter: brightness(1.6) saturate(0.7);
	opacity: 0.95;
}
</style>
