import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

export const vuetify = createVuetify({
	components,
	directives,
	icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
	theme: {
		defaultTheme: 'spyglass',
		themes: {
			spyglass: {
				dark: true,
				colors: {
					primary: '#5c6bc0',
					secondary: '#26c6da',
					background: '#0d0d1a',
					surface: '#12122a',
					error: '#ef5350',
					success: '#66bb6a',
					warning: '#ffa726',
					info: '#29b6f6'
				}
			}
		}
	}
})
