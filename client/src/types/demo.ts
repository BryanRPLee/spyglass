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
	z: number
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
	// World position where the bomb came to rest — derived from the carrying
	// player's location at the moment of the event (dropped/planted only;
	// defuse/explosion resolve in place so they don't need their own).
	x?: number
	y?: number
}

export interface ShotEvent {
	tick: number
	shooterSteamId: string
	shooterTeam: 'CT' | 'T'
	x: number
	y: number
}

export interface BlindEvent {
	tick: number
	victimSteamId: string
	victimTeam: 'CT' | 'T'
	attackerSteamId: string
	attackerTeam: 'CT' | 'T'
	duration: number // seconds the victim is blinded for
}

export interface RoundEvents {
	kills: KillEvent[]
	bombEvents: BombEvent[]
	shots: ShotEvent[]
	blinds: BlindEvent[]
}

export interface RoundData extends RoundSummary {
	frames: TickFrame[]
	events: RoundEvents
}
