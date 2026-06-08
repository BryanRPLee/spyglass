<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { DemoSummary } from '../../types/demo.js'

const props = defineProps<{ demo: DemoSummary }>()
const emit = defineEmits<{
	deleted: [id: string]
	refresh: [id: string]
}>()

const router = useRouter()

const statusColor = computed(
	() =>
		({
			PENDING: 'warning',
			PARSING: 'info',
			READY: 'success',
			ERROR: 'error'
		})[props.demo.status]
)

const statusIcon = computed(
	() =>
		({
			PENDING: 'mdi-clock-outline',
			PARSING: 'mdi-cog-sync-outline',
			READY: 'mdi-check-circle-outline',
			ERROR: 'mdi-alert-circle-outline'
		})[props.demo.status]
)

const date = computed(() =>
	new Date(props.demo.uploadedAt).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	})
)

function open() {
	if (props.demo.status === 'READY') router.push(`/demo/${props.demo.id}`)
}
</script>

<template>
	<v-card
		:class="['demo-card', { clickable: demo.status === 'READY' }]"
		:elevation="0"
		@click="open"
	>
		<div class="card-map-row d-flex align-center px-3 py-2">
			<v-icon size="16" color="blue-grey-lighten-2" class="mr-1"
				>mdi-map-outline</v-icon
			>
			<span
				class="text-caption text-blue-grey-lighten-2 text-uppercase font-weight-medium"
			>
				{{ demo.mapName || 'Unknown Map' }}
			</span>
			<v-spacer />
			<v-icon :color="statusColor" size="16" class="mr-1">{{
				statusIcon
			}}</v-icon>
			<span class="text-caption" :class="`text-${statusColor}`">{{
				demo.status
			}}</span>
		</div>

		<v-divider />

		<v-card-text class="pa-3">
			<div class="text-body-2 font-weight-medium text-truncate">
				{{ demo.filename }}
			</div>
			<div class="text-caption text-medium-emphasis mt-1">{{ date }}</div>
			<div
				v-if="demo.status === 'READY'"
				class="text-caption text-medium-emphasis"
			>
				{{ demo.roundCount }} rounds &middot; {{ demo.tickRate }} tick
			</div>
			<div
				v-if="demo.status === 'PARSING'"
				class="d-flex align-center mt-1 gap-2"
			>
				<v-progress-linear
					indeterminate
					color="info"
					height="2"
					class="flex-grow-1"
				/>
			</div>
			<div
				v-if="demo.status === 'ERROR'"
				class="text-caption text-error mt-1"
			>
				{{ demo.errorMsg ?? 'Parse error' }}
			</div>
		</v-card-text>

		<v-card-actions class="pa-2 pt-0">
			<v-btn
				v-if="
					demo.status === 'PENDING' ||
					demo.status === 'PARSING' ||
					demo.status === 'ERROR'
				"
				icon="mdi-refresh"
				size="x-small"
				variant="text"
				@click.stop="emit('refresh', demo.id)"
			/>
			<v-spacer />
			<v-btn
				icon="mdi-delete-outline"
				size="x-small"
				variant="text"
				color="error"
				@click.stop="emit('deleted', demo.id)"
			/>
		</v-card-actions>
	</v-card>
</template>

<style scoped>
.demo-card {
	background: #12122a;
	border: 1px solid rgba(255, 255, 255, 0.06);
	border-radius: 10px;
	transition:
		border-color 0.2s,
		transform 0.15s;
}
.demo-card.clickable {
	cursor: pointer;
}
.demo-card.clickable:hover {
	border-color: rgba(var(--v-theme-primary), 0.45);
	transform: translateY(-2px);
}
.card-map-row {
	background: rgba(255, 255, 255, 0.025);
}
</style>
