export interface MapMeta {
	name: string
	displayName: string
	posX: number
	posY: number
	scale: number
	radarSize: number
}

export const MAP_DATA: Record<string, MapMeta> = {
	de_dust2: {
		name: 'de_dust2',
		displayName: 'Dust 2',
		posX: -2476,
		posY: 3239,
		scale: 4.4,
		radarSize: 1024
	},
	de_mirage: {
		name: 'de_mirage',
		displayName: 'Mirage',
		posX: -3230,
		posY: 1713,
		scale: 5.0,
		radarSize: 1024
	},
	de_inferno: {
		name: 'de_inferno',
		displayName: 'Inferno',
		posX: -2087,
		posY: 3870,
		scale: 4.9,
		radarSize: 1024
	},
	de_nuke: {
		name: 'de_nuke',
		displayName: 'Nuke',
		posX: -3453,
		posY: 2887,
		scale: 7.0,
		radarSize: 1024
	},
	de_overpass: {
		name: 'de_overpass',
		displayName: 'Overpass',
		posX: -4831,
		posY: 1781,
		scale: 5.2,
		radarSize: 1024
	},
	de_ancient: {
		name: 'de_ancient',
		displayName: 'Ancient',
		posX: -2953,
		posY: 2164,
		scale: 5.0,
		radarSize: 1024
	},
	de_anubis: {
		name: 'de_anubis',
		displayName: 'Anubis',
		posX: -2796,
		posY: 3328,
		scale: 5.22,
		radarSize: 1024
	},
	de_vertigo: {
		name: 'de_vertigo',
		displayName: 'Vertigo',
		posX: -3168,
		posY: 1762,
		scale: 4.0,
		radarSize: 1024
	}
}

export function worldToCanvas(
	worldX: number,
	worldY: number,
	meta: MapMeta,
	canvasSize: number
): { x: number; y: number } {
	const radarX = (worldX - meta.posX) / meta.scale
	const radarY = (meta.posY - worldY) / meta.scale // flip Y
	return {
		x: (radarX / meta.radarSize) * canvasSize,
		y: (radarY / meta.radarSize) * canvasSize
	}
}

export function yawToDirection(yaw: number): { dx: number; dy: number } {
	const rad = (yaw * Math.PI) / 180
	return { dx: Math.cos(rad), dy: -Math.sin(rad) }
}
