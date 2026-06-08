<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlaybackStore } from '../../stores/playbackStore.js'
import { MAP_DATA, worldToCanvas, yawToDirection } from '../../data/maps.js'
import {
	ICON_SHEET,
	ICON_SHEET_SIZE,
	WEAPON_ICON_RECTS
} from '../../data/weaponIcons.js'
import {
	buildWalkabilityGrid,
	computeMapControl
} from '../../utils/mapControl.js'
import type {
	ControlHazard,
	ControlIntel,
	ControlOwner,
	ControlSource
} from '../../utils/mapControl.js'
import {
	buildIntelTimeline,
	GHOST_INTEL_RADIUS_WORLD
} from '../../utils/intel.js'
import type { IntelFrame } from '../../utils/intel.js'
import type {
	PlayerState,
	GrenadeState,
	BombEvent,
	TickFrame
} from '../../types/demo.js'
import type { MapMeta } from '../../data/maps.js'

const store = usePlaybackStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapRef = ref<HTMLDivElement | null>(null)

// Canvas tracks its container's actual rect (no more fixed square +
// object-fit letterboxing). The square radar is drawn to *fit* that rect at
// 1x — full map in frame on load, letterbox bars baked into the canvas fill
// itself (not CSS dead space) — and because the view transform scales the
// whole rect (bars included) around its center, zooming in naturally expands
// the map to cover the entire box instead of clipping at an inscribed square.
const viewSize = ref({ w: 680, h: 680 })
const mapSize = computed(() => Math.min(viewSize.value.w, viewSize.value.h))
const mapOffset = computed(() => ({
	x: (viewSize.value.w - mapSize.value) / 2,
	y: (viewSize.value.h - mapSize.value) / 2
}))

let resizeObserver: ResizeObserver | null = null
function syncViewSize() {
	const rect = wrapRef.value?.getBoundingClientRect()
	if (!rect || rect.width === 0 || rect.height === 0) return
	const w = Math.round(rect.width)
	const h = Math.round(rect.height)
	if (w === viewSize.value.w && h === viewSize.value.h) return
	viewSize.value = { w, h }
}

// Zoom/pan are applied as a canvas transform *before* drawing — text, sprites
// and shapes get rasterized at the zoomed scale directly onto the backing
// pixel grid, so they stay crisp. (A CSS transform would instead stretch the
// already-rasterized 1x output, pixelating icons and labels when zoomed in.)
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isPanning = ref(false)

const canvasCursor = computed(() =>
	zoom.value > MIN_ZOOM ? (isPanning.value ? 'grabbing' : 'grab') : 'default'
)

function maxPanOffset(): number {
	return (mapSize.value * (zoom.value - 1)) / 2
}

function clampPan(p: { x: number; y: number }): { x: number; y: number } {
	const m = maxPanOffset()
	return {
		x: Math.min(m, Math.max(-m, p.x)),
		y: Math.min(m, Math.max(-m, p.y))
	}
}

// Centers the scale on the canvas midpoint, then offsets by `pan` (in canvas
// pixels) so dragging tracks the cursor 1:1 regardless of zoom level.
function applyViewTransform(ctx: CanvasRenderingContext2D) {
	const cx = viewSize.value.w / 2
	const cy = viewSize.value.h / 2
	ctx.translate(pan.value.x, pan.value.y)
	ctx.translate(cx, cy)
	ctx.scale(zoom.value, zoom.value)
	ctx.translate(-cx, -cy)
}

function clampZoom(z: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

function zoomBy(delta: number) {
	const next = clampZoom(zoom.value + delta)
	zoom.value = next
	pan.value = next === MIN_ZOOM ? { x: 0, y: 0 } : clampPan(pan.value)
}

function onWheel(e: WheelEvent) {
	e.preventDefault()
	zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
}

function resetView() {
	zoom.value = 1
	pan.value = { x: 0, y: 0 }
}

// Mouse deltas arrive in screen pixels; the canvas's CSS size should match
// viewSize 1:1, but compute the ratio defensively so a drag still tracks the
// cursor exactly if a layout reflow lands between resize and redraw.
function canvasDisplayScale(): number {
	const rect = canvasRef.value?.getBoundingClientRect()
	return rect && rect.width > 0 ? rect.width / viewSize.value.w : 1
}

let panPointerStart = { x: 0, y: 0 }
let panOrigin = { x: 0, y: 0 }
let panDisplayScale = 1

function onPanStart(e: MouseEvent) {
	if (zoom.value <= MIN_ZOOM) return
	isPanning.value = true
	panPointerStart = { x: e.clientX, y: e.clientY }
	panOrigin = { ...pan.value }
	panDisplayScale = canvasDisplayScale()
	window.addEventListener('mousemove', onPanMove)
	window.addEventListener('mouseup', onPanEnd)
}

function onPanMove(e: MouseEvent) {
	if (!isPanning.value) return
	pan.value = clampPan({
		x: panOrigin.x + (e.clientX - panPointerStart.x) / panDisplayScale,
		y: panOrigin.y + (e.clientY - panPointerStart.y) / panDisplayScale
	})
}

function onPanEnd() {
	isPanning.value = false
	window.removeEventListener('mousemove', onPanMove)
	window.removeEventListener('mouseup', onPanEnd)
}

onBeforeUnmount(() => {
	window.removeEventListener('mousemove', onPanMove)
	window.removeEventListener('mouseup', onPanEnd)
	resizeObserver?.disconnect()
})

let mapImage: HTMLImageElement | null = null
let mapMeta: MapMeta | null = null

// Map control overlay — see utils/mapControl.ts for the flood-fill behind it.
// The walkability grid is derived from the radar PNG's alpha channel, so it's
// rebuilt only when the map image (re)loads, not every frame.
const showMapControl = ref(false)
const CONTROL_GRID_SIZE = 96
let walkabilityGrid: Uint8Array | null = null

function toggleMapControl() {
	showMapControl.value = !showMapControl.value
	drawAt(store.playbackProgress)
}

const CONTROL_COLORS: Record<Exclude<ControlOwner, 0>, string> = {
	1: 'rgba(33, 150, 243, 0.22)', // CT
	2: 'rgba(255, 109, 0, 0.22)', // T
	3: 'rgba(255, 255, 255, 0.08)' // contested
}

function drawMapControl(
	ctx: CanvasRenderingContext2D,
	frame: { tick: number; players: PlayerState[]; grenades: GrenadeState[] },
	meta: MapMeta
) {
	if (!walkabilityGrid) return

	const sources: ControlSource[] = []
	for (const p of frame.players) {
		if (!p.isAlive) continue
		const { x, y } = worldToCanvas(p.x, p.y, meta, CONTROL_GRID_SIZE)
		const gx = Math.floor(x)
		const gy = Math.floor(y)
		if (
			gx < 0 ||
			gy < 0 ||
			gx >= CONTROL_GRID_SIZE ||
			gy >= CONTROL_GRID_SIZE
		)
			continue
		// Demos parsed before `z` was tracked carry it as undefined, which lerping
		// turns into NaN — fall back to 0 so the z-gate degrades to "always contest"
		// (its pre-z behavior) instead of poisoning every comparison with NaN.
		const z = Number.isFinite(p.z) ? p.z : 0
		sources.push({ gx, gy, z, team: p.team })
	}
	if (sources.length === 0) return

	// Fold currently-active smokes/molotovs into the flood-fill as hazards —
	// same "is it still burning/deployed" check drawGrenade uses for its
	// countdown ring, just reused here to gate which ones affect control.
	const hazards: ControlHazard[] = []
	const worldToGrid = CONTROL_GRID_SIZE / (meta.scale * meta.radarSize)
	for (const g of frame.grenades) {
		if (g.type !== 'smoke' && g.type !== 'molotov') continue
		const spreadWorld = GRENADE_SPREAD_WORLD[g.type]
		if (!spreadWorld) continue
		const duration = GRENADE_DURATIONS[g.type]
		const episode = findGrenadeEpisode(g.entityId, g.type, frame.tick)
		if (duration && episode) {
			const elapsed = (frame.tick - episode.start) / store.tickRate
			if (elapsed >= duration) continue
		}
		const { x, y } = worldToCanvas(g.x, g.y, meta, CONTROL_GRID_SIZE)
		hazards.push({
			gx: Math.floor(x),
			gy: Math.floor(y),
			radius: spreadWorld * worldToGrid,
			team: g.team,
			kind: g.type
		})
	}

	const intel: ControlIntel[] = []
	const intelFrame = intelTimeline.get(frame.tick)
	if (intelFrame) {
		const intelRadius = GHOST_INTEL_RADIUS_WORLD * worldToGrid
		for (const [perceivingTeam, ghosts] of [
			['CT', intelFrame.ct],
			['T', intelFrame.t]
		] as const) {
			for (const ghost of ghosts) {
				const { x, y } = worldToCanvas(ghost.x, ghost.y, meta, CONTROL_GRID_SIZE)
				intel.push({
					gx: Math.floor(x),
					gy: Math.floor(y),
					radius: intelRadius,
					perceivingTeam,
					confidence: ghost.confidence
				})
			}
		}
	}

	const owner = computeMapControl(
		walkabilityGrid,
		CONTROL_GRID_SIZE,
		sources,
		hazards,
		intel
	)
	const cell = mapSize.value / CONTROL_GRID_SIZE

	for (let gy = 0; gy < CONTROL_GRID_SIZE; gy++) {
		for (let gx = 0; gx < CONTROL_GRID_SIZE; gx++) {
			const o = owner[gy * CONTROL_GRID_SIZE + gx]
			if (o === 0) continue
			ctx.fillStyle = CONTROL_COLORS[o]
			ctx.fillRect(gx * cell, gy * cell, cell + 0.5, cell + 0.5)
		}
	}
}

let bombIcon: HTMLImageElement | null = null
const bombIconImg = new Image()
bombIconImg.src = ICON_SHEET
bombIconImg.onload = () => {
	bombIcon = bombIconImg
	drawAt(store.playbackProgress)
}

// How long a thrown grenade lingers and affects the map, in seconds — used to
// drive the countdown ring. Grenades without an entry detonate instantly.
const GRENADE_DURATIONS: Partial<Record<GrenadeState['type'], number>> = {
	smoke: 18,
	molotov: 7,
	decoy: 15
}

// Effective area-of-denial radius in world units — drawn as a translucent
// circle so smokes/mollies read at a glance like they do on broadcast radars.
const GRENADE_SPREAD_WORLD: Partial<Record<GrenadeState['type'], number>> = {
	smoke: 145,
	molotov: 165
}

interface GrenadeEpisode {
	type: GrenadeState['type']
	start: number
	end: number
}

// One physical throw can reuse a recycled entity id later in the demo, so we
// segment each entity's appearances into contiguous tick runs ("episodes")
// and look up which run covers the tick being rendered.
let grenadeEpisodes = new Map<number, GrenadeEpisode[]>()
let intelTimeline = new Map<number, IntelFrame>()

function buildGrenadeEpisodes(
	frames: TickFrame[]
): Map<number, GrenadeEpisode[]> {
	const episodes = new Map<number, GrenadeEpisode[]>()
	const active = new Map<number, GrenadeEpisode>()

	const finish = (entityId: number, ep: GrenadeEpisode) => {
		let list = episodes.get(entityId)
		if (!list) {
			list = []
			episodes.set(entityId, list)
		}
		list.push(ep)
	}

	for (const frame of frames) {
		const present = new Set<number>()
		for (const g of frame.grenades) {
			present.add(g.entityId)
			const cur = active.get(g.entityId)
			if (cur && cur.type === g.type) {
				cur.end = frame.tick
			} else {
				if (cur) finish(g.entityId, cur)
				active.set(g.entityId, {
					type: g.type,
					start: frame.tick,
					end: frame.tick
				})
			}
		}
		for (const [id, ep] of active) {
			if (!present.has(id)) {
				finish(id, ep)
				active.delete(id)
			}
		}
	}
	for (const [id, ep] of active) finish(id, ep)

	return episodes
}

function findGrenadeEpisode(
	entityId: number,
	type: GrenadeState['type'],
	tick: number
): GrenadeEpisode | null {
	const list = grenadeEpisodes.get(entityId)
	if (!list) return null
	for (const ep of list) {
		if (ep.type === type && ep.start <= tick && tick <= ep.end) return ep
	}
	return null
}

function setupCanvas() {
	const canvas = canvasRef.value
	const ctx = canvas?.getContext('2d')
	if (!canvas || !ctx) return null

	const dpr = window.devicePixelRatio || 1
	canvas.width = viewSize.value.w * dpr
	canvas.height = viewSize.value.h * dpr
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	return ctx
}

watch(
	() => store.mapName,
	(name) => {
		if (!name) return
		mapMeta = MAP_DATA[name] ?? null
		walkabilityGrid = null
		const img = new Image()
		img.src = `/maps/${name}.png`
		img.onload = () => {
			mapImage = img
			walkabilityGrid = buildWalkabilityGrid(img, CONTROL_GRID_SIZE)
			drawAt(store.playbackProgress)
		}
		img.onerror = () => {
			console.warn(`[Spyglass] No radar image found at /maps/${name}.png`)
			mapImage = null
		}
	},
	{ immediate: true }
)

watch(
	() => store.playbackProgress,
	(progress) => drawAt(progress)
)

// Zoom/pan only move the view — they don't touch playbackProgress, so without
// this the canvas sits frozen on its last frame until playback ticks again
// (paused) or the next zoom happens to land on a frame that does redraw.
watch([zoom, pan], () => drawAt(store.playbackProgress), { deep: true })

// Container resized (window resize, sidebar toggle, etc.) — resize the
// backing buffer to match and redraw, otherwise the canvas keeps its old
// pixel dimensions while CSS stretches it, blurring everything.
watch(viewSize, () => {
	setupCanvas()
	drawAt(store.playbackProgress)
})

watch(
	() => store.frames,
	(frames) => {
		grenadeEpisodes = buildGrenadeEpisodes(frames)
		intelTimeline = buildIntelTimeline(frames, store.events, store.tickRate)
	},
	{ immediate: true }
)

onMounted(() => {
	syncViewSize()
	setupCanvas()
	drawAt(store.playbackProgress)

	if (wrapRef.value) {
		resizeObserver = new ResizeObserver(syncViewSize)
		resizeObserver.observe(wrapRef.value)
	}
})

// Smoothly blend angle a -> b across the shorter arc (handles the 360°/0° wrap).
function lerpAngle(a: number, b: number, t: number): number {
	const diff = ((b - a + 540) % 360) - 180
	return a + diff * t
}

function lerpPlayers(
	a: PlayerState[],
	b: PlayerState[],
	t: number
): PlayerState[] {
	if (t <= 0) return a
	const byId = new Map(b.map((p) => [p.steamId, p]))
	return a.map((pa) => {
		const pb = byId.get(pa.steamId)
		if (!pb || !pa.isAlive || !pb.isAlive) return pa
		return {
			...pa,
			x: pa.x + (pb.x - pa.x) * t,
			y: pa.y + (pb.y - pa.y) * t,
			z: pa.z + (pb.z - pa.z) * t,
			yaw: lerpAngle(pa.yaw, pb.yaw, t)
		}
	})
}

// Interpolates between the two sampled frames bracketing `progress` so motion
// glides at display framerate instead of snapping every TICK_STRIDE ticks.
function frameAt(progress: number): {
	tick: number
	players: PlayerState[]
	grenades: GrenadeState[]
} {
	const frames = store.frames
	if (frames.length === 0) return { tick: 0, players: [], grenades: [] }

	let idx = store.currentFrameIndex
	idx = Math.max(0, Math.min(idx, frames.length - 1))
	const a = frames[idx]
	const b = frames[idx + 1]
	if (!b) return { tick: a.tick, players: a.players, grenades: a.grenades }

	const span = b.tick - a.tick
	const t =
		span > 0 ? Math.min(1, Math.max(0, (progress - a.tick) / span)) : 0
	return {
		tick: a.tick,
		players: lerpPlayers(a.players, b.players, t),
		grenades: a.grenades
	}
}

function drawAt(progress: number) {
	const ctx = canvasRef.value?.getContext('2d')
	if (!ctx) return
	draw(ctx, frameAt(progress))
}

function draw(
	ctx: CanvasRenderingContext2D,
	frame: { tick: number; players: PlayerState[]; grenades: GrenadeState[] }
) {
	const { w, h } = viewSize.value
	const size = mapSize.value

	// Clear in the untransformed (DPR-only) space first so the whole physical
	// canvas wipes regardless of the current zoom/pan — then apply the view
	// transform, plus the cover offset that centers the square radar texture
	// inside a non-square viewport, around everything that scales/pans together.
	ctx.clearRect(0, 0, w, h)
	ctx.save()
	applyViewTransform(ctx)
	ctx.translate(mapOffset.value.x, mapOffset.value.y)

	if (mapImage) {
		ctx.drawImage(mapImage, 0, 0, size, size)
	} else {
		ctx.fillStyle = '#1a1a2e'
		ctx.fillRect(0, 0, size, size)
		ctx.fillStyle = 'rgba(255,255,255,0.08)'
		ctx.font = '14px monospace'
		ctx.textAlign = 'center'
		ctx.fillText(
			`No radar for "${store.mapName}" — place PNG in /public/maps/`,
			size / 2,
			size / 2
		)
	}

	if (mapMeta) {
		if (showMapControl.value) drawMapControl(ctx, frame, mapMeta)

		for (const g of frame.grenades) drawGrenade(ctx, g, mapMeta, frame.tick)

		for (const p of frame.players) drawPlayer(ctx, p, mapMeta)

		drawBombState(ctx, frame, mapMeta)
	}

	ctx.restore()
}

// Bomb position isn't sampled per-frame — it's reconstructed from the round's
// event log: the most recent dropped/planted/defused/exploded event at-or-before
// the current tick tells us whether it's loose on the ground or live at a site
// (defuse/explosion supersede the plant marker by simply being later events).
function latestBombEvent(events: BombEvent[], tick: number): BombEvent | null {
	let latest: BombEvent | null = null
	for (const e of events) {
		if (e.tick <= tick && (!latest || e.tick > latest.tick)) latest = e
	}
	return latest
}

function drawBombState(
	ctx: CanvasRenderingContext2D,
	frame: { tick: number; players: PlayerState[]; grenades: GrenadeState[] },
	meta: MapMeta
) {
	const event = latestBombEvent(store.events.bombEvents, frame.tick)
	if (!event) return

	const carrier = frame.players.find((p) => p.isAlive && p.hasBomb)

	if (event.type === 'planted') {
		if (event.x == null || event.y == null) return
		drawBombIcon(ctx, event.x, event.y, meta, frame.tick, {
			planted: true,
			site: event.site
		})
		return
	}

	// Dropped (and not yet picked back up) — show where it's sitting on the ground.
	if (event.type === 'dropped' && !carrier) {
		if (event.x == null || event.y == null) return
		drawBombIcon(ctx, event.x, event.y, meta, frame.tick, {
			planted: false
		})
	}
}

function drawBombIcon(
	ctx: CanvasRenderingContext2D,
	worldX: number,
	worldY: number,
	meta: MapMeta,
	tick: number,
	opts: { planted: boolean; site?: string }
) {
	const { x, y } = worldToCanvas(worldX, worldY, meta, mapSize.value)
	const rect = WEAPON_ICON_RECTS.c4
	const H = 16
	const scale = H / rect.h
	const w = rect.w * scale

	if (opts.planted) {
		// Pulsing red ring marks a live plant — the thing players most need to spot at a glance.
		const pulse = (Math.sin(tick / 6) + 1) / 2
		ctx.beginPath()
		ctx.arc(x, y, 13 + pulse * 3, 0, Math.PI * 2)
		ctx.strokeStyle = `rgba(229, 57, 53, ${0.5 + pulse * 0.4})`
		ctx.lineWidth = 2
		ctx.stroke()
	}

	if (bombIcon) {
		ctx.drawImage(
			bombIcon,
			rect.x,
			rect.y,
			rect.w,
			rect.h,
			x - w / 2,
			y - H / 2,
			w,
			H
		)
	} else {
		ctx.beginPath()
		ctx.arc(x, y, 5, 0, Math.PI * 2)
		ctx.fillStyle = '#fdd835'
		ctx.fill()
	}

	const label = opts.planted
		? `PLANTED${opts.site ? ` ${opts.site}` : ''}`
		: 'DROPPED'
	ctx.font = "bold 8px 'Courier New', monospace"
	ctx.textAlign = 'center'
	ctx.fillStyle = opts.planted ? '#e53935' : '#fdd835'
	ctx.fillText(label, x, y + H / 2 + 10)
}

function drawPlayer(
	ctx: CanvasRenderingContext2D,
	p: PlayerState,
	meta: MapMeta
) {
	const { x, y } = worldToCanvas(p.x, p.y, meta, mapSize.value)
	const isCT = p.team === 'CT'

	const FILL = isCT ? '#1565c0' : '#bf360c'
	const STROKE = isCT ? '#82b1ff' : '#ffcc80'
	const R = 7

	if (p.isAlive) {
		// Yaw indicator
		const { dx, dy } = yawToDirection(p.yaw)
		ctx.beginPath()
		ctx.moveTo(x, y)
		ctx.lineTo(x + dx * 14, y + dy * 14)
		ctx.strokeStyle = STROKE
		ctx.lineWidth = 2
		ctx.stroke()
	}

	ctx.beginPath()
	ctx.arc(x, y, R, 0, Math.PI * 2)
	ctx.fillStyle = p.isAlive ? FILL : 'rgba(60,60,60,0.6)'
	ctx.fill()
	ctx.strokeStyle = p.isAlive ? STROKE : '#555'
	ctx.lineWidth = 1.5
	ctx.stroke()

	if (!p.isAlive) {
		ctx.strokeStyle = '#e53935'
		ctx.lineWidth = 1.5
		ctx.beginPath()
		ctx.moveTo(x - 4, y - 4)
		ctx.lineTo(x + 4, y + 4)
		ctx.moveTo(x + 4, y - 4)
		ctx.lineTo(x - 4, y + 4)
		ctx.stroke()
		return
	}

	const BAR_W = 18,
		BAR_H = 3
	const bx = x - BAR_W / 2,
		by = y - R - 7
	ctx.fillStyle = 'rgba(0,0,0,0.6)'
	ctx.fillRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2)
	ctx.fillStyle = p.hp > 50 ? '#43a047' : p.hp > 25 ? '#fb8c00' : '#e53935'
	ctx.fillRect(bx, by, BAR_W * (p.hp / 100), BAR_H)

	const label = p.name.length > 9 ? p.name.slice(0, 8) + '…' : p.name
	ctx.font = "bold 8px 'Courier New', monospace"
	ctx.textAlign = 'center'
	ctx.fillStyle = '#ffffff'
	ctx.fillText(label, x, y + R + 9)
	if (p.hasBomb) {
		ctx.fillStyle = '#fdd835'
		ctx.beginPath()
		ctx.arc(x + R + 2, y - R - 2, 3, 0, Math.PI * 2)
		ctx.fill()
	}

	if (p.isDefusing) drawDefuseIcon(ctx, x, y)
}

// Defuse kit icon laid directly over the player's dot — the clearest spot to
// catch mid-defuse at a glance, since it's exactly where your eye already is.
function drawDefuseIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
	const rect = WEAPON_ICON_RECTS.defuseKit
	const H = 14
	const scale = H / rect.h
	const w = rect.w * scale

	ctx.beginPath()
	ctx.arc(x, y, H * 0.65, 0, Math.PI * 2)
	ctx.fillStyle = 'rgba(0,0,0,0.55)'
	ctx.fill()

	if (bombIcon) {
		ctx.drawImage(
			bombIcon,
			rect.x,
			rect.y,
			rect.w,
			rect.h,
			x - w / 2,
			y - H / 2,
			w,
			H
		)
	}
}
const GRENADE_COLORS: Record<
	GrenadeState['type'],
	{ fill: string; stroke: string; spread: string }
> = {
	smoke: {
		fill: '#9e9e9e',
		stroke: '#eeeeee',
		spread: 'rgba(158,158,158,0.16)'
	},
	he: { fill: '#f44336', stroke: '#ff8a65', spread: 'rgba(244,67,54,0.16)' },
	molotov: {
		fill: '#ff6d00',
		stroke: '#ffcc02',
		spread: 'rgba(255,109,0,0.18)'
	},
	flash: {
		fill: '#fff9c4',
		stroke: '#ffffff',
		spread: 'rgba(255,249,196,0.16)'
	},
	decoy: {
		fill: '#7c4dff',
		stroke: '#ea80fc',
		spread: 'rgba(124,77,255,0.16)'
	}
}

function drawGrenade(
	ctx: CanvasRenderingContext2D,
	g: GrenadeState,
	meta: MapMeta,
	tick: number
) {
	const duration = GRENADE_DURATIONS[g.type]
	const episode = findGrenadeEpisode(g.entityId, g.type, tick)
	if (duration && episode) {
		const elapsed = (tick - episode.start) / store.tickRate
		// Parser keeps emitting landed/lingering rows past the util's real
		// lifetime (e.g. round 16 apartments smokes) — stop drawing once its
		// timer has actually run out instead of trusting data presence alone.
		if (elapsed >= duration) return
	}

	const { x, y } = worldToCanvas(g.x, g.y, meta, mapSize.value)
	const { fill, stroke, spread } = GRENADE_COLORS[g.type]
	const R = g.type === 'smoke' ? 5 : 4

	const spreadWorld = GRENADE_SPREAD_WORLD[g.type]
	if (spreadWorld) {
		const edge = worldToCanvas(g.x + spreadWorld, g.y, meta, mapSize.value)
		const spreadR = Math.abs(edge.x - x)
		ctx.beginPath()
		ctx.arc(x, y, spreadR, 0, Math.PI * 2)
		ctx.fillStyle = spread
		ctx.fill()
		ctx.strokeStyle = stroke
		ctx.globalAlpha = 0.35
		ctx.lineWidth = 1
		ctx.stroke()
		ctx.globalAlpha = 1
	}

	ctx.beginPath()
	ctx.arc(x, y, R, 0, Math.PI * 2)
	ctx.fillStyle = fill
	ctx.fill()
	ctx.strokeStyle = stroke
	ctx.lineWidth = 1.5
	ctx.stroke()

	if (!duration || !episode) return

	const elapsed = (tick - episode.start) / store.tickRate
	const remaining = Math.max(0, duration - elapsed)
	const fraction = remaining / duration
	const ringR = R + 5

	ctx.beginPath()
	ctx.arc(x, y, ringR, 0, Math.PI * 2)
	ctx.strokeStyle = 'rgba(255,255,255,0.18)'
	ctx.lineWidth = 2
	ctx.stroke()

	// Countdown sweep starting at 12 o'clock, shrinking clockwise as the grenade burns out.
	ctx.beginPath()
	ctx.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2)
	ctx.strokeStyle = stroke
	ctx.lineWidth = 2
	ctx.stroke()
}
</script>
<template>
	<div
		ref="wrapRef"
		class="map-canvas-wrap"
		@wheel="onWheel"
		@mousedown="onPanStart"
	>
		<canvas
			ref="canvasRef"
			class="map-canvas"
			:style="{ cursor: canvasCursor }"
		/>

		<div class="layer-controls">
			<v-btn
				icon="mdi-checkerboard"
				size="x-small"
				variant="flat"
				:color="showMapControl ? 'primary' : 'rgba(0,0,0,0.5)'"
				@click="toggleMapControl"
			/>
		</div>

		<div class="zoom-controls d-flex flex-column align-center">
			<v-btn
				icon="mdi-plus"
				size="x-small"
				variant="flat"
				color="rgba(0,0,0,0.5)"
				@click="zoomBy(ZOOM_STEP)"
			/>
			<span class="zoom-level text-caption"
				>{{ Math.round(zoom * 100) }}%</span
			>
			<v-btn
				icon="mdi-minus"
				size="x-small"
				variant="flat"
				color="rgba(0,0,0,0.5)"
				@click="zoomBy(-ZOOM_STEP)"
			/>
			<v-btn
				icon="mdi-restore"
				size="x-small"
				variant="flat"
				color="rgba(0,0,0,0.5)"
				class="mt-1"
				@click="resetView"
			/>
		</div>
	</div>
</template>
<style scoped>
.map-canvas-wrap {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	border-radius: 4px;
}
.map-canvas {
	/* Backing buffer is sized to match the wrapper exactly (see syncViewSize) —
	   the square radar texture is drawn to *cover* this rect (mapSize/mapOffset),
	   so the whole box is map, not letterboxed into an inscribed square. Zoom/pan
	   are baked into the draw loop itself (see applyViewTransform) so icons/text
	   stay crisp instead of being CSS-stretched after rasterizing. */
	display: block;
	width: 100%;
	height: 100%;
	border-radius: 4px;
}
.layer-controls {
	position: absolute;
	top: 8px;
	left: 8px;
	background: rgba(0, 0, 0, 0.35);
	border-radius: 8px;
	padding: 4px;
}
.zoom-controls {
	position: absolute;
	top: 8px;
	right: 8px;
	gap: 2px;
	background: rgba(0, 0, 0, 0.35);
	border-radius: 8px;
	padding: 4px;
}
.zoom-level {
	color: rgba(255, 255, 255, 0.85);
	font-variant-numeric: tabular-nums;
	min-width: 34px;
	text-align: center;
}
</style>
