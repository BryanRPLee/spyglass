import { createRouter, createWebHistory } from 'vue-router'
import { watch, type Ref } from 'vue'
import { useAuth } from '@clerk/vue'

function waitForClerkLoaded(isLoaded: Ref<boolean>): Promise<void> {
	if (isLoaded.value) return Promise.resolve()
	return new Promise((resolve) => {
		const stop = watch(isLoaded, (loaded) => {
			if (loaded) {
				stop()
				resolve()
			}
		})
	})
}

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: '/',
			component: () => import('../views/HomeView.vue'),
			meta: { requiresAuth: false }
		},
		{
			path: '/dashboard',
			component: () => import('../views/DashboardView.vue'),
			meta: { requiresAuth: true }
		},
		{
			path: '/demo/:id',
			component: () => import('../views/DemoViewerView.vue'),
			meta: { requiresAuth: true }
		}
	]
})

router.beforeEach(async (to) => {
	if (!to.meta.requiresAuth) return true
	const { isSignedIn, isLoaded } = useAuth()
	await waitForClerkLoaded(isLoaded)
	if (!isSignedIn.value) return '/'
	return true
})
