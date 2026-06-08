<script setup lang="ts">
import { computed } from 'vue'
import { usePlaybackStore } from '../../stores/playbackStore.js'

const store = usePlaybackStore()

const recentKills = computed(() => [...store.killsUpToNow].reverse())
</script>

<template>
	<div class="kill-feed">
		<div
			v-if="recentKills.length === 0"
			class="text-caption text-medium-emphasis pa-3"
		>
			No kills yet this round.
		</div>

		<div
			v-for="(kill, i) in recentKills"
			:key="`${kill.tick}-${i}`"
			class="kill-row d-flex align-center px-3 py-1"
		>
			<span
				class="name text-truncate"
				:class="kill.attackerTeam === 'CT' ? 'text-ct' : 'text-t'"
				>{{ kill.attackerName }}</span
			>

			<v-icon v-if="kill.headshot" size="11" color="amber" class="mx-1"
				>mdi-target</v-icon
			>
			<span class="weapon text-caption text-medium-emphasis mx-1">{{
				kill.weapon
			}}</span>
			<v-icon size="11" color="blue-grey-lighten-2" class="mr-1"
				>mdi-skull-outline</v-icon
			>

			<span
				class="name text-truncate"
				:class="kill.victimTeam === 'CT' ? 'text-ct' : 'text-t'"
				>{{ kill.victimName }}</span
			>
		</div>
	</div>
</template>

<style scoped>
.kill-feed {
	display: flex;
	flex-direction: column-reverse;
}
.kill-row {
	font-size: 11px;
	font-weight: 600;
	border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	gap: 2px;
}
.name {
	max-width: 80px;
}
.weapon {
	white-space: nowrap;
}
.text-ct {
	color: #82b1ff;
}
.text-t {
	color: #ffcc80;
}
</style>
