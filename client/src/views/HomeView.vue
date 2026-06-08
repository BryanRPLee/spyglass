<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, SignInButton } from '@clerk/vue'

const router = useRouter()
const { isSignedIn, isLoaded } = useAuth()

watch([isLoaded, isSignedIn], ([loaded, signedIn]) => {
	if (loaded && signedIn) router.replace('/dashboard')
})
</script>

<template>
	<div class="d-flex align-center justify-center" style="height: 100vh">
		<div class="text-center">
			<div
				class="text-h2 font-weight-black mb-2"
				style="letter-spacing: -0.03em"
			>
				<span style="color: rgb(var(--v-theme-primary))">Spy</span>glass
			</div>
			<div class="text-body-1 text-medium-emphasis mb-10">
				CS2 Demo Analysis Platform
			</div>

			<SignInButton v-if="!isSignedIn" mode="modal">
				<v-btn
					color="primary"
					size="large"
					prepend-icon="mdi-login-variant"
				>
					Sign in to get started
				</v-btn>
			</SignInButton>

			<v-btn
				v-if="isSignedIn"
				color="primary"
				size="large"
				to="/dashboard"
			>
				Go to Dashboard
			</v-btn>
		</div>
	</div>
</template>
