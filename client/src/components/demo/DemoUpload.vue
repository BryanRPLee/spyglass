<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '../../api/client.js'
import type { DemoSummary } from '../../types/demo.js'

const emit = defineEmits<{ uploaded: [demo: DemoSummary] }>()

const api = useApi()
const dragging = ref(false)
const uploading = ref(false)
const error = ref<string | null>(null)

async function handleFile(file: File) {
	if (!file.name.endsWith('.dem')) {
		error.value = 'Only .dem files are supported.'
		return
	}
	error.value = null
	uploading.value = true
	try {
		const demo = await api.demos.upload(file)
		emit('uploaded', demo)
	} catch (e) {
		error.value = String(e)
	} finally {
		uploading.value = false
	}
}

function onDrop(e: DragEvent) {
	dragging.value = false
	const file = e.dataTransfer?.files[0]
	if (file) handleFile(file)
}

function onInput(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0]
	if (file) handleFile(file)
	;(e.target as HTMLInputElement).value = ''
}
</script>

<template>
	<div
		:class="['upload-zone', { dragging }]"
		@dragenter.prevent="dragging = true"
		@dragleave.prevent="dragging = false"
		@dragover.prevent
		@drop.prevent="onDrop"
	>
		<v-progress-circular
			v-if="uploading"
			indeterminate
			color="primary"
			size="40"
			class="mb-2"
		/>
		<template v-else>
			<v-icon size="48" color="primary" class="mb-3"
				>mdi-file-upload-outline</v-icon
			>
			<div class="text-body-1 mb-1">Drop your .dem file here</div>
			<div class="text-caption text-medium-emphasis mb-4">or</div>
			<label>
				<v-btn
					variant="outlined"
					color="primary"
					size="small"
					tag="span"
					>Browse files</v-btn
				>
				<input
					type="file"
					accept=".dem"
					style="display: none"
					@change="onInput"
				/>
			</label>
		</template>

		<v-alert
			v-if="error"
			type="error"
			density="compact"
			class="mt-4"
			variant="tonal"
		>
			{{ error }}
		</v-alert>
	</div>
</template>

<style scoped>
.upload-zone {
	border: 2px dashed rgba(255, 255, 255, 0.12);
	border-radius: 12px;
	padding: 48px 32px;
	text-align: center;
	transition:
		border-color 0.2s,
		background 0.2s;
}
.upload-zone.dragging {
	border-color: rgb(var(--v-theme-primary));
	background: rgba(var(--v-theme-primary), 0.06);
}
</style>
