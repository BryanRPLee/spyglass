export type DemoStatus = 'PENDING' | 'PARSING' | 'READY' | 'ERROR'

export interface DemoSummary {
	id: string
	filename: string
	mapName: string
	tickRate: number
	status: DemoStatus
	errorMsg: string | null
	uploadedAt: string
	parsedAt: string | null
	roundCount: number
}

export interface RoundSummary {
	id: string
	roundNumber: number
	startTick: number
	endTick: number
	winnerTeam: 'CT' | 'T' | null
	winReason: string | null
}

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
	activeWeapon: string
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
	type: 'planted' | 'defused' | 'exploded'
	site?: string
}

export interface RoundEvents {
	kills: KillEvent[]
	bombEvents: BombEvent[]
}

export interface RoundData extends RoundSummary {
	frames: TickFrame[]
	events: RoundEvents
}
