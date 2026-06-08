export type ControlOwner = 0 | 1 | 2 | 3 // none, CT, T, contested

export interface ControlSource {
	gx: number
	gy: number
	z: number
	team: 'CT' | 'T'
}

const CT_BIT = 1
const T_BIT = 2

// The radar is a flat top-down projection, so a player on a catwalk and one
// directly below it land in the same cell — without nav-mesh data we can't
// know a cell is actually two stacked floors. Z height is the next best signal:
// two opposing waves meeting with a small z gap are genuinely fighting over the
// same ground (contested); a gap wider than a typical Source-engine floor means
// they're probably on different levels, so the lower one (the "real" floor
// beneath the catwalk) wins instead of painting a false standoff.
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

export function computeMapControl(
	walkable: Uint8Array,
	gridSize: number,
	sources: ControlSource[]
): Uint8Array {
	const size = gridSize * gridSize
	const owner = new Uint8Array(size)
	const ownerZ = new Float32Array(size) // z carried forward by whichever wave claimed the cell
	const visited = new Uint8Array(size)
	const claimMask = new Uint8Array(size)
	const claimZ = new Float32Array(size * 2) // [ctZ, tZ] per cell — only meaningful while the matching claimMask bit is set

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

	let frontier: number[] = []
	let touched: number[] = []

	for (const s of sources) {
		if (!inBounds(s.gx, s.gy)) continue
		const i = idx(s.gx, s.gy)
		if (!walkable[i]) continue
		if (claimMask[i] === 0) touched.push(i)
		claim(i, s.team, s.z)
	}
	for (const i of touched) {
		if (settle(i) !== 3) frontier.push(i)
	}
	touched = []

	while (frontier.length > 0) {
		for (const i of frontier) {
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
				if (claimMask[ni] === 0) touched.push(ni)
				claim(ni, team, z)
			}
		}

		frontier = []
		for (const i of touched) {
			if (settle(i) !== 3) frontier.push(i)
		}
		touched = []
	}

	return owner
}
