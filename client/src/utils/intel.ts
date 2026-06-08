import type { PlayerState, RoundEvents, TickFrame } from '../types/demo.js'

export type AudioKind =
	| 'gunfire'
	| 'footstep'
	| 'jump'
	| 'bomb'
	| 'nadeThrow'
	| 'nadePin'

interface AudioEvent {
	tick: number
	x: number
	y: number
	team: 'CT' | 'T'
	radius: number
}

export interface GhostSnapshot {
	perceivedTeam: 'CT' | 'T'
	x: number
	y: number
	confidence: number
}

export interface IntelFrame {
	ct: GhostSnapshot[]
	t: GhostSnapshot[]
}

interface GhostState {
	perceivedTeam: 'CT' | 'T'
	x: number
	y: number
	vx: number
	vy: number
	lastTick: number
}

interface BlindWindow {
	start: number
	end: number
}

const RADII: Record<AudioKind, number> = {
	gunfire: 2000,
	footstep: 1100,
	jump: 900,
	bomb: 2000,
	nadeThrow: 1100,
	nadePin: 400
}

const RUN_SPEED = 170
const WALK_SPEED = 60
const JUMP_VERTICAL_DELTA = 12

export const GHOST_INTEL_RADIUS_WORLD = 600
const GHOST_MERGE_RADIUS = GHOST_INTEL_RADIUS_WORLD
const GHOST_DECAY_SECONDS = 12
const PROJECTION_CAP_SECONDS = 4
const MOLOTOV_PIN_LEAD_SECONDS = 1

function opposite(team: 'CT' | 'T'): 'CT' | 'T' {
	return team === 'CT' ? 'T' : 'CT'
}

function dist(ax: number, ay: number, bx: number, by: number): number {
	return Math.hypot(ax - bx, ay - by)
}

function frameStride(frames: TickFrame[]): number {
	return frames.length > 1 ? frames[1].tick - frames[0].tick : 1
}

function buildAudioEvents(
	frames: TickFrame[],
	roundEvents: RoundEvents,
	tickRate: number
): AudioEvent[] {
	const events: AudioEvent[] = []

	for (const s of roundEvents.shots) {
		events.push({
			tick: s.tick,
			x: s.x,
			y: s.y,
			team: s.shooterTeam,
			radius: RADII.gunfire
		})
	}

	for (const b of roundEvents.bombEvents) {
		if (b.x == null || b.y == null) continue
		if (b.type === 'dropped' || b.type === 'planted') {
			events.push({
				tick: b.tick,
				x: b.x,
				y: b.y,
				team: 'T',
				radius: RADII.bomb
			})
		} else if (b.type === 'defused') {
			events.push({
				tick: b.tick,
				x: b.x,
				y: b.y,
				team: 'CT',
				radius: RADII.bomb
			})
		}
	}

	const seenGrenades = new Set<number>()
	const pinLeadTicks = Math.round(tickRate * MOLOTOV_PIN_LEAD_SECONDS)
	for (const frame of frames) {
		for (const g of frame.grenades) {
			if (seenGrenades.has(g.entityId)) continue
			seenGrenades.add(g.entityId)
			events.push({
				tick: frame.tick,
				x: g.x,
				y: g.y,
				team: g.team,
				radius: RADII.nadeThrow
			})
			if (g.type === 'molotov') {
				events.push({
					tick: frame.tick - pinLeadTicks,
					x: g.x,
					y: g.y,
					team: g.team,
					radius: RADII.nadePin
				})
			}
		}
	}

	const stride = frameStride(frames)
	const dt = stride / tickRate
	const lastSeen = new Map<string, PlayerState>()
	for (const frame of frames) {
		for (const p of frame.players) {
			const prev = lastSeen.get(p.steamId)
			lastSeen.set(p.steamId, p)
			if (!prev || !p.isAlive || !prev.isAlive) continue

			const speed = dist(prev.x, prev.y, p.x, p.y) / dt
			const verticalDelta = p.z - prev.z
			const isWalking = speed >= WALK_SPEED && speed < RUN_SPEED

			if (speed >= RUN_SPEED) {
				events.push({
					tick: frame.tick,
					x: p.x,
					y: p.y,
					team: p.team,
					radius: RADII.footstep
				})
			}

			if (verticalDelta > JUMP_VERTICAL_DELTA && !isWalking) {
				events.push({
					tick: frame.tick,
					x: p.x,
					y: p.y,
					team: p.team,
					radius: RADII.jump
				})
			}
		}
	}

	events.sort((a, b) => a.tick - b.tick)
	return events
}

function buildBlindWindows(
	roundEvents: RoundEvents,
	tickRate: number
): Map<string, BlindWindow[]> {
	const map = new Map<string, BlindWindow[]>()
	for (const b of roundEvents.blinds) {
		if (b.duration <= 0) continue
		let list = map.get(b.victimSteamId)
		if (!list) {
			list = []
			map.set(b.victimSteamId, list)
		}
		list.push({ start: b.tick, end: b.tick + Math.round(b.duration * tickRate) })
	}
	return map
}

function isImpaired(
	windows: Map<string, BlindWindow[]>,
	steamId: string,
	tick: number
): boolean {
	const list = windows.get(steamId)
	if (!list) return false
	for (const w of list) {
		if (tick >= w.start && tick <= w.end) return true
	}
	return false
}

function updateGhost(
	ghosts: GhostState[],
	evt: AudioEvent,
	tickRate: number
): void {
	let nearest: GhostState | null = null
	let nearestDist = Infinity
	for (const g of ghosts) {
		if (g.perceivedTeam !== evt.team) continue
		const d = dist(g.x, g.y, evt.x, evt.y)
		if (d < nearestDist) {
			nearestDist = d
			nearest = g
		}
	}

	if (nearest && nearestDist <= GHOST_MERGE_RADIUS) {
		const dt = (evt.tick - nearest.lastTick) / tickRate
		nearest.vx = dt > 0 ? (evt.x - nearest.x) / dt : 0
		nearest.vy = dt > 0 ? (evt.y - nearest.y) / dt : 0
		nearest.x = evt.x
		nearest.y = evt.y
		nearest.lastTick = evt.tick
		return
	}

	ghosts.push({
		perceivedTeam: evt.team,
		x: evt.x,
		y: evt.y,
		vx: 0,
		vy: 0,
		lastTick: evt.tick
	})
}

function projectGhosts(
	ghosts: GhostState[],
	tick: number,
	tickRate: number,
	decayTicks: number
): GhostSnapshot[] {
	const capTicks = PROJECTION_CAP_SECONDS * tickRate
	return ghosts.map((g) => {
		const age = tick - g.lastTick
		const elapsed = Math.min(age, capTicks) / tickRate
		return {
			perceivedTeam: g.perceivedTeam,
			x: g.x + g.vx * elapsed,
			y: g.y + g.vy * elapsed,
			confidence: Math.max(0, 1 - age / decayTicks)
		}
	})
}

export function buildIntelTimeline(
	frames: TickFrame[],
	roundEvents: RoundEvents,
	tickRate: number
): Map<number, IntelFrame> {
	const timeline = new Map<number, IntelFrame>()
	if (frames.length === 0) return timeline

	const stride = frameStride(frames)
	const frameByTick = new Map(frames.map((f) => [f.tick, f]))
	const blindWindows = buildBlindWindows(roundEvents, tickRate)
	const audioEvents = buildAudioEvents(frames, roundEvents, tickRate)
	const decayTicks = GHOST_DECAY_SECONDS * tickRate

	const ghostsByTeam: Record<'CT' | 'T', GhostState[]> = { CT: [], T: [] }

	let eventIdx = 0
	for (const frame of frames) {
		while (
			eventIdx < audioEvents.length &&
			audioEvents[eventIdx].tick <= frame.tick
		) {
			const evt = audioEvents[eventIdx]
			eventIdx++

			const snapped = Math.floor(evt.tick / stride) * stride
			const evtFrame = frameByTick.get(snapped)
			if (!evtFrame) continue

			const perceivingTeam = opposite(evt.team)
			for (const listener of evtFrame.players) {
				if (!listener.isAlive || listener.team !== perceivingTeam) continue
				if (dist(listener.x, listener.y, evt.x, evt.y) > evt.radius) continue
				if (isImpaired(blindWindows, listener.steamId, evt.tick)) continue

				updateGhost(ghostsByTeam[perceivingTeam], evt, tickRate)
				break
			}
		}

		for (const team of ['CT', 'T'] as const) {
			ghostsByTeam[team] = ghostsByTeam[team].filter(
				(g) => frame.tick - g.lastTick <= decayTicks
			)
		}

		timeline.set(frame.tick, {
			ct: projectGhosts(ghostsByTeam.CT, frame.tick, tickRate, decayTicks),
			t: projectGhosts(ghostsByTeam.T, frame.tick, tickRate, decayTicks)
		})
	}

	return timeline
}
