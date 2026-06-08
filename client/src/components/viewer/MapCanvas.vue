<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { usePlaybackStore } from '../../stores/playbackStore.js'
import { MAP_DATA, worldToCanvas, yawToDirection } from '../../data/maps.js'
import type { PlayerState, GrenadeState } from '../../types/demo.js'
import type { MapMeta } from '../../data/maps.js'

const CANVAS_SIZE = 680

const store = usePlaybackStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

let mapImage: HTMLImageElement | null = null
let mapMeta: MapMeta | null = null

function setupCanvas() {
	const canvas = canvasRef.value
	const ctx = canvas?.getContext('2d')
	if (!canvas || !ctx) return null

	const dpr = window.devicePixelRatio || 1
	canvas.width = CANVAS_SIZE * dpr
	canvas.height = CANVAS_SIZE * dpr
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	return ctx
}

watch(
	() => store.mapName,
	(name) => {
		if (!name) return
		mapMeta = MAP_DATA[name] ?? null
		const img = new Image()
		img.src = `/maps/${name}.png`
		img.onload = () => {
			mapImage = img
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

onMounted(() => {
	setupCanvas()
	drawAt(store.playbackProgress)
})

// Smoothly blend angle a -> b across the shorter arc (handles the 360°/0° wrap).
function lerpAngle(a: number, b: number, t: number): number {
	const diff = ((b - a + 540) % 360) - 180
	return a + diff * t
}

function lerpPlayers(a: PlayerState[], b: PlayerState[], t: number): PlayerState[] {
	if (t <= 0) return a
	const byId = new Map(b.map((p) => [p.steamId, p]))
	return a.map((pa) => {
		const pb = byId.get(pa.steamId)
		if (!pb || !pa.isAlive || !pb.isAlive) return pa
		return {
			...pa,
			x: pa.x + (pb.x - pa.x) * t,
			y: pa.y + (pb.y - pa.y) * t,
			yaw: lerpAngle(pa.yaw, pb.yaw, t)
		}
	})
}

// Interpolates between the two sampled frames bracketing `progress` so motion
// glides at display framerate instead of snapping every TICK_STRIDE ticks.
function frameAt(progress: number): { players: PlayerState[]; grenades: GrenadeState[] } {
	const frames = store.frames
	if (frames.length === 0) return { players: [], grenades: [] }

	let idx = store.currentFrameIndex
	idx = Math.max(0, Math.min(idx, frames.length - 1))
	const a = frames[idx]
	const b = frames[idx + 1]
	if (!b) return a

	const span = b.tick - a.tick
	const t = span > 0 ? Math.min(1, Math.max(0, (progress - a.tick) / span)) : 0
	return { players: lerpPlayers(a.players, b.players, t), grenades: a.grenades }
}

function drawAt(progress: number) {
	const ctx = canvasRef.value?.getContext('2d')
	if (!ctx) return
	draw(ctx, frameAt(progress))
}

function draw(
	ctx: CanvasRenderingContext2D,
	frame: { players: PlayerState[]; grenades: GrenadeState[] }
) {
	ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

	if (mapImage) {
		ctx.drawImage(mapImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
	} else {
		ctx.fillStyle = '#1a1a2e'
		ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
		ctx.fillStyle = 'rgba(255,255,255,0.08)'
		ctx.font = '14px monospace'
		ctx.textAlign = 'center'
		ctx.fillText(
			`No radar for "${store.mapName}" — place PNG in /public/maps/`,
			CANVAS_SIZE / 2,
			CANVAS_SIZE / 2
		)
	}

	if (!mapMeta) return

	for (const g of frame.grenades) drawGrenade(ctx, g, mapMeta)

	for (const p of frame.players) drawPlayer(ctx, p, mapMeta)
}

function drawPlayer(
	ctx: CanvasRenderingContext2D,
	p: PlayerState,
	meta: MapMeta
) {
	const { x, y } = worldToCanvas(p.x, p.y, meta, CANVAS_SIZE)
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
}
const GRENADE_COLORS: Record<
	GrenadeState['type'],
	{ fill: string; stroke: string }
> = {
	smoke: { fill: '#9e9e9e', stroke: '#eeeeee' },
	he: { fill: '#f44336', stroke: '#ff8a65' },
	molotov: { fill: '#ff6d00', stroke: '#ffcc02' },
	flash: { fill: '#fff9c4', stroke: '#ffffff' },
	decoy: { fill: '#7c4dff', stroke: '#ea80fc' }
}
function drawGrenade(
	ctx: CanvasRenderingContext2D,
	g: GrenadeState,
	meta: MapMeta
) {
	const { x, y } = worldToCanvas(g.x, g.y, meta, CANVAS_SIZE)
	const { fill, stroke } = GRENADE_COLORS[g.type]
	const R = g.type === 'smoke' ? 5 : 4
	ctx.beginPath()
	ctx.arc(x, y, R, 0, Math.PI * 2)
	ctx.fillStyle = fill
	ctx.fill()
	ctx.strokeStyle = stroke
	ctx.lineWidth = 1.5
	ctx.stroke()
}
</script>
<template>
	<canvas ref="canvasRef" class="map-canvas" />
</template>
<style scoped>
.map-canvas {
	width: 680px;
	height: 680px;
	max-width: 100%;
	max-height: 100%;
	border-radius: 4px;
	aspect-ratio: 1;
}
</style>
