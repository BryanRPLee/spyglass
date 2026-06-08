import 'dotenv/config'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { demosRoutes } from './routes/demos.js'

const app = Fastify({ logger: true })

await app.register(cors, {
	origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
	credentials: true
})

await app.register(multipart, {
	limits: { fileSize: 500 * 1024 * 1024 }
})

await app.register(demosRoutes, { prefix: '/api/demos' })

app.get('/health', () => ({ status: 'ok' }))

try {
	await app.listen({
		port: Number(process.env.PORT ?? 3001),
		host: '0.0.0.0'
	})
} catch (err) {
	app.log.error(err)
	process.exit(1)
}
