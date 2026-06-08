import type {} from '@fastify/multipart'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { verifyClerkToken } from '../lib/clerk.js'
import { prisma } from '../lib/prisma.js'
import { parseDemo } from '../services/demoParser.js'

declare module 'fastify' {
	interface FastifyRequest {
		userId: string
	}
}

type Params = { id: string }
type RoundParams = { id: string; roundId: string }

async function authenticate(req: FastifyRequest, reply: FastifyReply) {
	const auth = req.headers.authorization
	if (!auth?.startsWith('Bearer ')) {
		return reply.status(401).send({ error: 'Unauthorized' })
	}
	try {
		const userId = await verifyClerkToken(auth.slice(7))
		req.userId = userId

		await prisma.user.upsert({
			where: { id: userId },
			update: {},
			create: { id: userId, email: `${userId}@clerk` }
		})
	} catch {
		return reply.status(401).send({ error: 'Invalid token' })
	}
}

function demoResponse(demo: any, roundCount: number) {
	return {
		id: demo.id,
		filename: demo.filename,
		mapName: demo.mapName,
		tickRate: demo.tickRate,
		status: demo.status,
		errorMsg: demo.errorMsg ?? null,
		uploadedAt: demo.uploadedAt,
		parsedAt: demo.parsedAt ?? null,
		roundCount
	}
}

export async function demosRoutes(app: FastifyInstance) {
	app.post('/upload', { preHandler: authenticate }, async (req, reply) => {
		const file = await req.file()
		if (!file) return reply.status(400).send({ error: 'No file provided' })
		if (!file.filename.endsWith('.dem')) {
			return reply.status(400).send({ error: 'File must be a .dem file' })
		}

		const chunks: Buffer[] = []
		for await (const chunk of file.file) chunks.push(chunk)
		const buffer = Buffer.concat(chunks)

		const tmpPath = path.join(os.tmpdir(), `spyglass-${Date.now()}.dem`)
		fs.writeFileSync(tmpPath, buffer)

		const demo = await prisma.demo.create({
			data: {
				userId: req.userId,
				filename: file.filename,
				status: 'PENDING'
			}
		})

		void (async () => {
			try {
				await prisma.demo.update({
					where: { id: demo.id },
					data: { status: 'PARSING' }
				})

				const parsed = parseDemo(tmpPath)

				for (const round of parsed.rounds) {
					await prisma.round.create({
						data: {
							demoId: demo.id,
							roundNumber: round.roundNumber,
							startTick: round.startTick,
							endTick: round.endTick,
							winnerTeam: round.winnerTeam ?? null,
							winReason: round.winReason ?? null,
							framesData: JSON.stringify(round.frames),
							eventsData: JSON.stringify(round.events)
						}
					})
				}

				await prisma.demo.update({
					where: { id: demo.id },
					data: {
						status: 'READY',
						mapName: parsed.mapName,
						tickRate: parsed.tickRate,
						parsedAt: new Date()
					}
				})
			} catch (err) {
				await prisma.demo.update({
					where: { id: demo.id },
					data: { status: 'ERROR', errorMsg: String(err) }
				})
			} finally {
				fs.unlink(tmpPath, () => {})
			}
		})()

		return reply.status(201).send(demoResponse(demo, 0))
	})

	app.get('/', { preHandler: authenticate }, async (req) => {
		const demos = await prisma.demo.findMany({
			where: { userId: req.userId },
			include: { _count: { select: { rounds: true } } },
			orderBy: { uploadedAt: 'desc' }
		})
		return demos.map((d) => demoResponse(d, d._count.rounds))
	})

	app.get<{ Params: Params }>(
		'/:id',
		{ preHandler: authenticate },
		async (req, reply) => {
			const demo = await prisma.demo.findFirst({
				where: { id: req.params.id, userId: req.userId },
				include: { _count: { select: { rounds: true } } }
			})
			if (!demo)
				return reply.status(404).send({ error: 'Demo not found' })
			return demoResponse(demo, demo._count.rounds)
		}
	)

	app.delete<{ Params: Params }>(
		'/:id',
		{ preHandler: authenticate },
		async (req, reply) => {
			const demo = await prisma.demo.findFirst({
				where: { id: req.params.id, userId: req.userId }
			})
			if (!demo)
				return reply.status(404).send({ error: 'Demo not found' })
			await prisma.demo.delete({ where: { id: demo.id } })
			return reply.status(204).send()
		}
	)

	app.get<{ Params: Params }>(
		'/:id/rounds',
		{ preHandler: authenticate },
		async (req, reply) => {
			const demo = await prisma.demo.findFirst({
				where: { id: req.params.id, userId: req.userId }
			})
			if (!demo)
				return reply.status(404).send({ error: 'Demo not found' })

			const rounds = await prisma.round.findMany({
				where: { demoId: demo.id },
				orderBy: { roundNumber: 'asc' },
				select: {
					id: true,
					roundNumber: true,
					startTick: true,
					endTick: true,
					winnerTeam: true,
					winReason: true
				}
			})
			return rounds
		}
	)

	app.get<{ Params: RoundParams }>(
		'/:id/rounds/:roundId',
		{ preHandler: authenticate },
		async (req, reply) => {
			const demo = await prisma.demo.findFirst({
				where: { id: req.params.id, userId: req.userId }
			})
			if (!demo)
				return reply.status(404).send({ error: 'Demo not found' })

			const round = await prisma.round.findFirst({
				where: { id: req.params.roundId, demoId: demo.id }
			})
			if (!round)
				return reply.status(404).send({ error: 'Round not found' })

			return {
				id: round.id,
				roundNumber: round.roundNumber,
				startTick: round.startTick,
				endTick: round.endTick,
				winnerTeam: round.winnerTeam,
				winReason: round.winReason,
				frames: JSON.parse(round.framesData),
				events: JSON.parse(round.eventsData)
			}
		}
	)
}
