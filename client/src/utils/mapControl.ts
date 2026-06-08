export type ControlOwner = 0 | 1 | 2 | 3 // none, CT, T, contested

export interface ControlSource {
	gx: number
	gy: number
	z: number
	team: 'CT' | 'T'
}

export interface ControlHazard {
	gx: number
	gy: number
	radius: number
	team: 'CT' | 'T'
	kind: 'smoke' | 'molotov'
}

const CT_BIT = 1
const T_BIT = 2

const HAZARD_SMOKE_CT = 1
const HAZARD_SMOKE_T = 2
const HAZARD_FIRE = 4

const SMOKE_COST = 3

const Z_GATE = 120

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1]
]

export function buildWalkabilityGrid(
	image: HTMLImageElement,
	gridSize: number
): Uint8Array {
	const canvas = document.createElement('canvas')
	canvas.width = gridSize
	canvas.height = gridSize
	const ctx = canvas.getContext('2d')
	const grid = new Uint8Array(gridSize * gridSize)
	if (!ctx) return grid

	ctx.drawImage(image, 0, 0, gridSize, gridSize)
	const { data } = ctx.getImageData(0, 0, gridSize, gridSize)
	for (let i = 0; i < grid.length; i++) {
		grid[i] = data[i * 4 + 3] > 127 ? 1 : 0
	}
	return grid
}

// Stamps each hazard's circular footprint into a per-cell bitmask so the
// flood-fill can look up "what's burning/smoked here" in O(1) per step.
function rasterizeHazards(
	mask: Uint8Array,
	gridSize: number,
	hazards: ControlHazard[]
): void {
	for (const h of hazards) {
		if (h.radius <= 0) continue
		const bit =
			h.kind === 'molotov'
				? HAZARD_FIRE
				: h.team === 'CT'
					? HAZARD_SMOKE_CT
					: HAZARD_SMOKE_T
		const r2 = h.radius * h.radius
		const minX = Math.max(0, Math.floor(h.gx - h.radius))
		const maxX = Math.min(gridSize - 1, Math.ceil(h.gx + h.radius))
		const minY = Math.max(0, Math.floor(h.gy - h.radius))
		const maxY = Math.min(gridSize - 1, Math.ceil(h.gy + h.radius))
		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				const dx = x - h.gx
				const dy = y - h.gy
				if (dx * dx + dy * dy <= r2) mask[y * gridSize + x] |= bit
			}
		}
	}
}

export function computeMapControl(
	walkable: Uint8Array,
	gridSize: number,
	sources: ControlSource[],
	hazards: ControlHazard[] = []
): Uint8Array {
	const size = gridSize * gridSize
	const owner = new Uint8Array(size)
	const ownerZ = new Float32Array(size) // z carried forward by whichever wave claimed the cell
	const visited = new Uint8Array(size)
	const claimMask = new Uint8Array(size)
	const claimZ = new Float32Array(size * 2) // [ctZ, tZ] per cell — only meaningful while the matching claimMask bit is set

	const hazardMask = new Uint8Array(size)
	if (hazards.length > 0) rasterizeHazards(hazardMask, gridSize, hazards)

	// Cost for `team` to step into cell `i`. Molotov fire denies the ground to
	// both sides outright; an enemy smoke just slows the advance (see SMOKE_COST).
	const stepCost = (i: number, team: 'CT' | 'T'): number => {
		const mask = hazardMask[i]
		if (mask & HAZARD_FIRE) return Infinity
		const enemySmoke = team === 'CT' ? HAZARD_SMOKE_T : HAZARD_SMOKE_CT
		return mask & enemySmoke ? SMOKE_COST : 1
	}

	const idx = (x: number, y: number) => y * gridSize + x
	const inBounds = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < gridSize && y < gridSize

	const claim = (i: number, team: 'CT' | 'T', z: number) => {
		claimMask[i] |= team === 'CT' ? CT_BIT : T_BIT
		claimZ[i * 2 + (team === 'CT' ? 0 : 1)] = z
	}

	// Resolves a cell's claim(s) into a final owner, gating contested status by
	// how close the two waves' carried z values are (see Z_GATE comment above).
	const settle = (i: number): ControlOwner => {
		const mask = claimMask[i]
		let o: ControlOwner
		if (mask !== (CT_BIT | T_BIT)) {
			o = mask === CT_BIT ? 1 : 2
		} else {
			const ctZ = claimZ[i * 2]
			const tZ = claimZ[i * 2 + 1]
			o = Math.abs(ctZ - tZ) <= Z_GATE ? 3 : ctZ < tZ ? 1 : 2
		}

		owner[i] = o
		ownerZ[i] =
			o === 1
				? claimZ[i * 2]
				: o === 2
					? claimZ[i * 2 + 1]
					: (claimZ[i * 2] + claimZ[i * 2 + 1]) / 2
		visited[i] = 1
		claimMask[i] = 0
		return o
	}

	type QueueEntry = readonly [cell: number, team: 'CT' | 'T', z: number]
	const buckets: QueueEntry[][] = []
	const enqueue = (dist: number, entry: QueueEntry) => {
		;(buckets[dist] ??= []).push(entry)
	}

	for (const s of sources) {
		if (!inBounds(s.gx, s.gy)) continue
		const i = idx(s.gx, s.gy)
		if (!walkable[i]) continue
		enqueue(0, [i, s.team, s.z])
	}

	for (let d = 0; d < buckets.length; d++) {
		const batch = buckets[d]
		if (!batch) continue

		const touched: number[] = []
		for (const [i, team, z] of batch) {
			if (visited[i]) continue
			if (claimMask[i] === 0) touched.push(i)
			claim(i, team, z)
		}

		for (const i of touched) {
			if (settle(i) === 3) continue
			const team: 'CT' | 'T' = owner[i] === 1 ? 'CT' : 'T'
			const z = ownerZ[i]
			const x = i % gridSize
			const y = (i / gridSize) | 0
			for (const [dx, dy] of NEIGHBORS) {
				const nx = x + dx
				const ny = y + dy
				if (!inBounds(nx, ny)) continue
				const ni = idx(nx, ny)
				if (visited[ni] || !walkable[ni]) continue
				const cost = stepCost(ni, team)
				if (!Number.isFinite(cost)) continue
				enqueue(d + cost, [ni, team, z])
			}
		}
	}

	return owner
}
