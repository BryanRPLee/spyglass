import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { clerkPlugin } from '@clerk/vue'
import App from './App.vue'
import { router } from './router/index.js'
import { vuetify } from './plugins/vuetify.js'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)
app.use(clerkPlugin, {
	publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string
})

app.mount('#app')
