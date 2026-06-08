<script setup lang="ts">
import { useAuth, UserButton } from '@clerk/vue'
const { isSignedIn } = useAuth()
</script>

<template>
	<v-app theme="spyglass">
		<v-app-bar
			v-if="isSignedIn"
			flat
			height="52"
			style="
				background: #0d0d1a;
				border-bottom: 1px solid rgba(255, 255, 255, 0.06);
			"
		>
			<v-app-bar-title>
				<router-link to="/dashboard" class="text-decoration-none">
					<span
						class="text-h6 font-weight-black"
						style="letter-spacing: -0.02em"
					>
						<span style="color: rgb(var(--v-theme-primary))"
							>Spy</span
						><span class="text-white">glass</span>
					</span>
				</router-link>
			</v-app-bar-title>
			<template #append>
				<div v-if="isSignedIn" class="mr-4">
					<UserButton />
				</div>
			</template>
		</v-app-bar>

		<v-main style="background: #0d0d1a; min-height: 100vh">
			<router-view />
		</v-main>
	</v-app>
</template>
