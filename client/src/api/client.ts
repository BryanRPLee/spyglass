import { useAuth } from '@clerk/vue'
import type { DemoSummary, RoundSummary, RoundData } from '../types/demo.js'

const BASE = (import.meta.env.VITE_API_URL as string) ?? ''

export function useApi() {
	const { getToken } = useAuth()

	async function authFetch<T>(
		path: string,
		init: RequestInit = {}
	): Promise<T> {
		const token = await getToken.value()
		const isForm = init.body instanceof FormData

		const headers: Record<string, string> = {
			...(init.headers as Record<string, string>)
		}
		if (init.body && !isForm) headers['Content-Type'] = 'application/json'
		if (token) headers['Authorization'] = `Bearer ${token}`

		const res = await fetch(`${BASE}${path}`, { ...init, headers })

		if (res.status === 204) return undefined as T

		if (!res.ok) {
			const body = await res.json().catch(() => ({}))
			throw new Error(body.error ?? `HTTP ${res.status}`)
		}

		return res.json() as Promise<T>
	}

	return {
		demos: {
			list: () => authFetch<DemoSummary[]>('/api/demos'),

			get: (id: string) => authFetch<DemoSummary>(`/api/demos/${id}`),

			upload: (file: File) => {
				const form = new FormData()
				form.append('file', file)
				return authFetch<DemoSummary>('/api/demos/upload', {
					method: 'POST',
					body: form
				})
			},

			delete: (id: string) =>
				authFetch<void>(`/api/demos/${id}`, { method: 'DELETE' }),

			getRounds: (id: string) =>
				authFetch<RoundSummary[]>(`/api/demos/${id}/rounds`),

			getRoundData: (demoId: string, roundId: string) =>
				authFetch<RoundData>(`/api/demos/${demoId}/rounds/${roundId}`)
		}
	}
}
