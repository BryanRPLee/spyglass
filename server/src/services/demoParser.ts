import {
	parseEvent,
	parseTicks,
	parseGrenades,
	parseHeader
} from '@laihoe/demoparser2'
import type {
	ParsedDemo,
	ParsedRound,
	TickFrame,
	PlayerState,
	GrenadeState,
	KillEvent,
	BombEvent,
	RoundEvents
} from '../types/demo.js'

const TICK_STRIDE = 4

const TEAM_T = 2
const TEAM_CT = 3

function toTeam(num: number): 'CT' | 'T' {
	return num === TEAM_CT ? 'CT' : 'T'
}

function normalizeGrenadeType(raw: string): GrenadeState['type'] | null {
	const t = (raw ?? '').toLowerCase()
	if (t.includes('smoke')) return 'smoke'
	if (t.includes('he') || t.includes('high_explosive')) return 'he'
	if (t.includes('molotov') || t.includes('incendiary')) return 'molotov'
	if (t.includes('flash')) return 'flash'
	if (t.includes('decoy')) return 'decoy'
	return null
}

export function parseDemo(filePath: string): ParsedDemo {
	const header = parseHeader(filePath)
	const mapName: string = String(header.map_name ?? 'unknown')
	const playbackTicks: number = Number(header.playback_ticks ?? 0)
	const playbackTime: number = Number(header.playback_time ?? 1)
	const tickRate = Math.round(playbackTicks / playbackTime) || 64

	const roundStartEvents = parseEvent(filePath, 'round_start', []) as any[]
	const roundEndEvents = parseEvent(filePath, 'round_end', [
		'winner',
		'reason'
	]) as any[]

	const allKills = parseEvent(filePath, 'player_death', [
		'attacker_steamid',
		'attacker_name',
		'attacker_team_num',
		'user_steamid',
		'user_name',
		'user_team_num',
		'weapon',
		'headshot'
	]) as any[]

	const allBombPlants = parseEvent(filePath, 'bomb_planted', [
		'site'
	]) as any[]
	const allBombDefuses = parseEvent(filePath, 'bomb_defused', [
		'site'
	]) as any[]
	const allBombExplosions = parseEvent(filePath, 'bomb_exploded', [
		'site'
	]) as any[]

	const allGrenadeData = parseGrenades(filePath) as any[]

	const allPlayerTicks = parseTicks(filePath, [
		'X',
		'Y',
		'Z',
		'yaw',
		'health',
		'team_num',
		'is_alive',
		'armor_value',
		'active_weapon',
		'has_c4'
	]) as any[]

	const tickPlayerMap = new Map<number, PlayerState[]>()
	for (const row of allPlayerTicks) {
		const tick: number = Number(row.tick)
		if (tick % TICK_STRIDE !== 0) continue // sample

		const steamId = String(row.steamid ?? row.SteamID64 ?? '')
		if (!steamId || steamId === '0') continue

		if (!tickPlayerMap.has(tick)) tickPlayerMap.set(tick, [])
		tickPlayerMap.get(tick)!.push({
			steamId,
			name: String(row.name ?? ''),
			team: toTeam(Number(row.team_num ?? 0)),
			x: Number(row.X ?? 0),
			y: Number(row.Y ?? 0),
			yaw: Number(row.yaw ?? 0),
			hp: Number(row.health ?? 0),
			armor: Number(row.armor_value ?? 0),
			isAlive: Boolean(row.is_alive),
			hasBomb: Boolean(row.has_c4),
			activeWeapon: String(row.active_weapon ?? '')
		})
	}

	const grenadeMap = new Map<number, GrenadeState[]>()
	for (const g of allGrenadeData) {
		const gType = normalizeGrenadeType(String(g.grenade_type ?? ''))
		if (!gType) continue
		const rawTick: number = Number(g.tick ?? 0)
		const snapped = Math.round(rawTick / TICK_STRIDE) * TICK_STRIDE
		if (!grenadeMap.has(snapped)) grenadeMap.set(snapped, [])
		grenadeMap.get(snapped)!.push({
			entityId: Number(g.entity_id ?? 0),
			type: gType,
			x: Number(g.X ?? g.x ?? 0),
			y: Number(g.Y ?? g.y ?? 0),
			team: toTeam(Number(g.thrower_team_num ?? 0)),
			throwerSteamId: String(g.thrower_steamid ?? '')
		})
	}

	const endTickList = roundEndEvents.map((e: any) => Number(e.tick))

	const rounds: ParsedRound[] = []

	for (let i = 0; i < roundStartEvents.length; i++) {
		const startTick = Number(roundStartEvents[i].tick)
		const endTick =
			endTickList[i] ??
			Number(roundStartEvents[i + 1]?.tick ?? playbackTicks)

		if (endTick <= startTick) continue

		const endEvt = roundEndEvents[i]
		const winnerTeam: 'CT' | 'T' | undefined = endEvt
			? toTeam(Number(endEvt.winner))
			: undefined
		const winReason: string | undefined =
			endEvt?.reason != null ? String(endEvt.reason) : undefined

		const frames: TickFrame[] = []
		const firstSampledTick = Math.ceil(startTick / TICK_STRIDE) * TICK_STRIDE
		for (let tick = firstSampledTick; tick <= endTick; tick += TICK_STRIDE) {
			frames.push({
				tick,
				players: tickPlayerMap.get(tick) ?? [],
				grenades: grenadeMap.get(tick) ?? []
			})
		}

		const kills: KillEvent[] = allKills
			.filter(
				(e) => Number(e.tick) >= startTick && Number(e.tick) <= endTick
			)
			.map((e) => ({
				tick: Number(e.tick),
				attackerName: String(e.attacker_name ?? ''),
				attackerSteamId: String(e.attacker_steamid ?? ''),
				attackerTeam: toTeam(Number(e.attacker_team_num ?? 0)),
				victimName: String(e.user_name ?? ''),
				victimSteamId: String(e.user_steamid ?? ''),
				victimTeam: toTeam(Number(e.user_team_num ?? 0)),
				weapon: String(e.weapon ?? ''),
				headshot: Boolean(e.headshot)
			}))

		const bombEvents: BombEvent[] = []
		const inRound = (e: any) =>
			Number(e.tick) >= startTick && Number(e.tick) <= endTick

		for (const e of allBombPlants.filter(inRound)) {
			bombEvents.push({
				tick: Number(e.tick),
				type: 'planted',
				site: String(e.site ?? '')
			})
		}
		for (const e of allBombDefuses.filter(inRound)) {
			bombEvents.push({
				tick: Number(e.tick),
				type: 'defused',
				site: String(e.site ?? '')
			})
		}
		for (const e of allBombExplosions.filter(inRound)) {
			bombEvents.push({
				tick: Number(e.tick),
				type: 'exploded',
				site: String(e.site ?? '')
			})
		}

		const events: RoundEvents = { kills, bombEvents }

		rounds.push({
			roundNumber: i + 1,
			startTick,
			endTick,
			winnerTeam,
			winReason,
			frames,
			events
		})
	}

	return { mapName, tickRate, rounds }
}
