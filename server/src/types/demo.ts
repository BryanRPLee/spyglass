export interface PlayerState {
	steamId: string
	name: string
	team: 'CT' | 'T'
	x: number
	y: number
	yaw: number
	hp: number
	armor: number
	isAlive: boolean
	hasBomb: boolean
	hasHelmet: boolean
	hasDefuseKit: boolean
	isDefusing: boolean
	activeWeapon: string
	inventory: string[]
	kills: number
	deaths: number
	assists: number
}

export interface GrenadeState {
	entityId: number
	type: 'smoke' | 'he' | 'molotov' | 'flash' | 'decoy'
	x: number
	y: number
	team: 'CT' | 'T'
	throwerSteamId: string
}

export interface TickFrame {
	tick: number
	players: PlayerState[]
	grenades: GrenadeState[]
}

export interface KillEvent {
	tick: number
	attackerName: string
	attackerSteamId: string
	attackerTeam: 'CT' | 'T'
	victimName: string
	victimSteamId: string
	victimTeam: 'CT' | 'T'
	weapon: string
	headshot: boolean
}

export interface BombEvent {
	tick: number
	type: 'dropped' | 'planted' | 'defused' | 'exploded'
	site?: string
	x?: number
	y?: number
}

export interface RoundEvents {
	kills: KillEvent[]
	bombEvents: BombEvent[]
}

export interface ParsedRound {
	roundNumber: number
	startTick: number
	endTick: number
	winnerTeam?: 'CT' | 'T'
	winReason?: string
	frames: TickFrame[]
	events: RoundEvents
}

export interface ParsedDemo {
	mapName: string
	tickRate: number
	rounds: ParsedRound[]
}
