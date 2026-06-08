<script setup lang="ts">
import { computed } from 'vue'
import { usePlaybackStore } from '../../stores/playbackStore.js'
import {
	spriteStyle,
	iconForWeapon,
	categorizeInventory,
	type InventoryLoadout
} from '../../data/weaponIcons.js'
import type { PlayerState } from '../../types/demo.js'

const props = defineProps<{ team: 'CT' | 'T' }>()
const store = usePlaybackStore()

const players = computed<PlayerState[]>(() => {
	const list = (store.currentFrame?.players ?? []).filter(
		(p) => p.team === props.team
	)
	// Sort by steamId only — a stable key independent of alive/kill state, so
	// rows don't reorder mid-round when a player dies or scores.
	return [...list].sort((a, b) => a.steamId.localeCompare(b.steamId))
})

const loadouts = computed<Map<string, InventoryLoadout>>(() => {
	const map = new Map<string, InventoryLoadout>()
	for (const p of players.value)
		map.set(p.steamId, categorizeInventory(p.inventory))
	return map
})

const ICON_HEIGHT = 16
const iconStyle = (key: ReturnType<typeof iconForWeapon>) =>
	spriteStyle(key, ICON_HEIGHT)
</script>

<template>
	<div class="team-hud" :class="team === 'CT' ? 'side-ct' : 'side-t'">
		<div class="team-label text-caption font-weight-bold px-2 pt-2 pb-1">
			{{ team === 'CT' ? 'COUNTER-TERRORISTS' : 'TERRORISTS' }}
		</div>

		<div
			v-if="players.length === 0"
			class="text-caption text-medium-emphasis pa-3"
		>
			No data for this side.
		</div>

		<div
			v-for="p in players"
			:key="p.steamId"
			class="player-row px-2 py-1"
			:class="{ dead: !p.isAlive }"
		>
			<div class="d-flex align-center">
				<span class="hp-track">
					<span
						class="hp-fill"
						:style="{ width: `${p.isAlive ? p.hp : 0}%` }"
					/>
				</span>
				<span class="player-name text-truncate">{{ p.name }}</span>
				<v-icon
					v-if="!p.isAlive"
					size="12"
					color="blue-grey-darken-1"
					class="ml-1"
					>mdi-skull-outline</v-icon
				>
				<v-icon
					v-else-if="p.hasBomb"
					size="12"
					color="amber"
					class="ml-1"
					>mdi-radiobox-marked</v-icon
				>
			</div>

			<div class="d-flex align-center justify-space-between mt-1">
				<span class="kda text-caption">
					{{ p.kills }}<span class="kda-sep">/</span>{{ p.deaths
					}}<span class="kda-sep">/</span>{{ p.assists }}
				</span>
				<div class="d-flex align-center gear-icons">
					<span
						v-if="p.hasHelmet"
						class="icon-sprite"
						:style="iconStyle('kevlarHelmet')"
						title="Kevlar + Helmet"
					/>
					<span
						v-else-if="p.armor > 0"
						class="icon-sprite"
						:style="iconStyle('kevlar')"
						title="Kevlar"
					/>
					<span
						v-if="p.hasDefuseKit"
						class="icon-sprite"
						:style="iconStyle('defuseKit')"
						title="Defuse Kit"
					/>
				</div>
			</div>

			<div class="d-flex align-center flex-wrap loadout mt-1">
				<span
					v-if="loadouts.get(p.steamId)?.primary"
					class="icon-sprite"
					:style="
						iconStyle(
							iconForWeapon(loadouts.get(p.steamId)!.primary!)
						)
					"
					:title="loadouts.get(p.steamId)!.primary!"
				/>
				<span
					v-if="loadouts.get(p.steamId)?.secondary"
					class="icon-sprite"
					:style="
						iconStyle(
							iconForWeapon(loadouts.get(p.steamId)!.secondary!)
						)
					"
					:title="loadouts.get(p.steamId)!.secondary!"
				/>
				<span
					v-for="(g, gi) in loadouts.get(p.steamId)?.grenades ?? []"
					:key="gi"
					class="icon-sprite"
					:style="iconStyle(iconForWeapon(g))"
					:title="g"
				/>
				<v-icon
					v-if="loadouts.get(p.steamId)?.hasZeus"
					size="14"
					color="amber-lighten-2"
					class="ml-1"
					title="Zeus x27"
					>mdi-flash</v-icon
				>
			</div>
		</div>
	</div>
</template>

<style scoped>
.team-hud {
	display: flex;
	flex-direction: column;
	overflow-y: auto;
}
.team-label {
	letter-spacing: 0.5px;
}
.side-ct .team-label {
	color: #82b1ff;
}
.side-t .team-label {
	color: #ffcc80;
}
.player-row {
	border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.player-row.dead {
	opacity: 0.45;
}
.player-row.dead .player-name {
	text-decoration: line-through;
}
.hp-track {
	position: relative;
	display: inline-block;
	width: 28px;
	height: 5px;
	border-radius: 2px;
	background: rgba(255, 255, 255, 0.1);
	overflow: hidden;
	margin-right: 6px;
	flex-shrink: 0;
}
.hp-fill {
	position: absolute;
	inset: 0 auto 0 0;
	background: #43a047;
	transition: width 120ms linear;
}
.side-t .hp-fill {
	background: #ffb74d;
}
.side-ct .hp-fill {
	background: #64b5f6;
}
.player-name {
	font-size: 12px;
	font-weight: 600;
	max-width: 110px;
}
.kda {
	font-variant-numeric: tabular-nums;
	color: rgba(255, 255, 255, 0.65);
	letter-spacing: 0.5px;
}
.kda-sep {
	color: rgba(255, 255, 255, 0.3);
	margin: 0 2px;
}
.gear-icons {
	gap: 4px;
}
.loadout {
	gap: 6px;
	min-height: 18px;
}
.icon-sprite {
	display: inline-block;
	flex-shrink: 0;
	filter: brightness(1.6) saturate(0.7);
	opacity: 0.9;
}
</style>
