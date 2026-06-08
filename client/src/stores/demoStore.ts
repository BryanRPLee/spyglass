import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DemoSummary } from '../types/demo.js'

export const useDemoStore = defineStore('demo', () => {
	const demos = ref<DemoSummary[]>([])
	return { demos }
})
