<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useApi } from '../api/client.js'
import { useDemoStore } from '../stores/demoStore.js'
import DemoUpload from '../components/demo/DemoUpload.vue'
import DemoCard from '../components/demo/DemoCard.vue'
import type { DemoSummary } from '../types/demo.js'

const api = useApi()
const store = useDemoStore()
const loading = ref(false)
const showUpload = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
	await loadDemos()
	pollTimer = setInterval(async () => {
		const hasPending = store.demos.some(
			(d) => d.status === 'PENDING' || d.status === 'PARSING'
		)
		if (hasPending) await loadDemos()
	}, 3000)
})

onUnmounted(() => {
	if (pollTimer) clearInterval(pollTimer)
})

async function loadDemos() {
	loading.value = true
	try {
		store.demos = await api.demos.list()
	} finally {
		loading.value = false
	}
}

async function onUploaded(demo: DemoSummary) {
	store.demos.unshift(demo)
	showUpload.value = false
}

async function onDeleted(id: string) {
	await api.demos.delete(id)
	store.demos = store.demos.filter((d) => d.id !== id)
}

async function onRefresh(id: string) {
	const updated = await api.demos.get(id)
	const idx = store.demos.findIndex((d) => d.id === id)
	if (idx !== -1) store.demos[idx] = updated
}
</script>

<template>
	<v-container class="py-8">
		<div class="d-flex align-center mb-6 flex-wrap gap-3">
			<div>
				<div class="text-h5 font-weight-bold">My Demos</div>
				<div class="text-caption text-medium-emphasis">
					Upload and replay your CS2 match demos
				</div>
			</div>
			<v-spacer />
			<v-btn
				:color="showUpload ? 'default' : 'primary'"
				:variant="showUpload ? 'outlined' : 'elevated'"
				prepend-icon="mdi-upload"
				@click="showUpload = !showUpload"
			>
				Upload Demo
			</v-btn>
		</div>

		<v-expand-transition>
			<div v-if="showUpload" class="mb-6">
				<DemoUpload @uploaded="onUploaded" />
			</div>
		</v-expand-transition>

		<div
			v-if="loading && store.demos.length === 0"
			class="d-flex justify-center py-16"
		>
			<v-progress-circular indeterminate color="primary" />
		</div>

		<div
			v-else-if="store.demos.length === 0"
			class="d-flex flex-column align-center py-16 text-center"
		>
			<v-icon size="72" color="blue-grey-darken-3" class="mb-4">
				mdi-database-off-outline
			</v-icon>
			<div class="text-body-1 text-medium-emphasis">
				No demos yet — upload your first .dem file to get started.
			</div>
		</div>

		<v-row v-else>
			<v-col
				v-for="demo in store.demos"
				:key="demo.id"
				cols="12"
				sm="6"
				md="4"
				lg="3"
			>
				<DemoCard
					:demo="demo"
					@deleted="onDeleted"
					@refresh="onRefresh"
				/>
			</v-col>
		</v-row>
	</v-container>
</template>
