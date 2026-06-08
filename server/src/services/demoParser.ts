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

// bomb_dropped/bomb_planted carry the player's steamid but not a world
// position, so we resolve "where the bomb ended up" from that player's last
// known location at-or-before the event tick (the C4 model lands wherever
// they were standing/dropped from).
function buildPositionIndex(
	rows: any[]
): Map<string, { tick: number; x: number; y: number }[]> {
	const index = new Map<string, { tick: number; x: number; y: number }[]>()
	for (const row of rows) {
		const steamId = String(row.steamid ?? row.SteamID64 ?? '')
		if (!steamId || steamId === '0') continue
		let list = index.get(steamId)
		if (!list) {
			list = []
			index.set(steamId, list)
		}
		list.push({
			tick: Number(row.tick),
			x: Number(row.X ?? 0),
			y: Number(row.Y ?? 0)
		})
	}
	for (const list of index.values()) list.sort((a, b) => a.tick - b.tick)
	return index
}

function positionAt(
	index: Map<string, { tick: number; x: number; y: number }[]>,
	steamId: string,
	tick: number
): { x: number; y: number } | null {
	const list = index.get(steamId)
	if (!list || list.length === 0) return null
	let result = list[0]
	for (const entry of list) {
		if (entry.tick > tick) break
		result = entry
	}
	return { x: result.x, y: result.y }
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

	const allBombDrops = parseEvent(filePath, 'bomb_dropped', [
		'user_steamid'
	]) as any[]
	const allBombPlants = parseEvent(filePath, 'bomb_planted', [
		'site',
		'user_steamid'
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
		'active_weapon_name',
		'has_c4',
		'has_helmet',
		'has_defuser',
		'is_defusing',
		'inventory',
		'kills_total',
		'deaths_total',
		'assists_total'
	]) as any[]

	const positionIndex = buildPositionIndex(allPlayerTicks)

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
			z: Number(row.Z ?? 0),
			yaw: Number(row.yaw ?? 0),
			hp: Number(row.health ?? 0),
			armor: Number(row.armor_value ?? 0),
			isAlive: Boolean(row.is_alive),
			hasBomb: Boolean(row.has_c4),
			hasHelmet: Boolean(row.has_helmet),
			hasDefuseKit: Boolean(row.has_defuser),
			isDefusing: Boolean(row.is_defusing),
			activeWeapon: String(row.active_weapon_name ?? ''),
			inventory: Array.isArray(row.inventory)
				? row.inventory.map((w: unknown) => String(w))
				: [],
			kills: Number(row.kills_total ?? 0),
			deaths: Number(row.deaths_total ?? 0),
			assists: Number(row.assists_total ?? 0)
		})
	}

	// Once a grenade lands, demoparser2 keeps emitting rows for it under its
	// landed entity class (e.g. CIncendiaryGrenade) but stops reporting X/Y —
	// so we carry the last known in-flight position forward per entity, and
	// drop any rows seen before a position is known (otherwise they default
	// to world origin and render as a phantom util in the middle of the map).
	const grenadeRowsByEntity = new Map<number, any[]>()
	for (const g of allGrenadeData) {
		const id = Number(g.grenade_entity_id ?? 0)
		let rows = grenadeRowsByEntity.get(id)
		if (!rows) {
			rows = []
			grenadeRowsByEntity.set(id, rows)
		}
		rows.push(g)
	}

	// A physical throw's rows arrive on consecutive sampled ticks; a gap this
	// large between rows for the same entity id means the engine recycled the
	// id for an unrelated later throw, not that the same util kept existing.
	const GRENADE_EPISODE_GAP_TICKS = tickRate

	const grenadeMap = new Map<number, GrenadeState[]>()
	for (const [entityId, rows] of grenadeRowsByEntity) {
		rows.sort((a, b) => Number(a.tick) - Number(b.tick))

		let lastX: number | null = null
		let lastY: number | null = null
		let lastRowTick: number | null = null

		for (const g of rows) {
			const rawType = String(g.grenade_type ?? '')
			const gType = normalizeGrenadeType(rawType)
			if (!gType) continue

			const rawTickForGap: number = Number(g.tick ?? 0)
			if (
				lastRowTick !== null &&
				rawTickForGap - lastRowTick > GRENADE_EPISODE_GAP_TICKS
			) {
				// Recycled entity id starting a brand new throw — drop the stale
				// position so it can't bleed into this throw's pre-Projectile rows.
				lastX = null
				lastY = null
			}
			lastRowTick = rawTickForGap

			// Only "...Projectile" rows are the in-flight entity and carry a
			// real world position; held-in-inventory rows report the carrying
			// player's position (which would render the util on the map before
			// it's even thrown), and landed rows report none. So we seed/advance
			// lastX/lastY from Projectile rows only, and forward-fill the rest —
			// this also means nothing renders until the grenade is actually thrown.
			const rawX = g.X ?? g.x
			const rawY = g.Y ?? g.y
			if (
				rawType.includes('Projectile') &&
				rawX != null &&
				rawY != null
			) {
				lastX = Number(rawX)
				lastY = Number(rawY)
			}
			if (lastX === null || lastY === null) continue

			const rawTick: number = Number(g.tick ?? 0)
			const snapped = Math.round(rawTick / TICK_STRIDE) * TICK_STRIDE
			if (!grenadeMap.has(snapped)) grenadeMap.set(snapped, [])
			grenadeMap.get(snapped)!.push({
				entityId,
				type: gType,
				x: lastX,
				y: lastY,
				team: toTeam(Number(g.thrower_team_num ?? 0)),
				throwerSteamId: String(g.thrower_steamid ?? '')
			})
		}
	}

	const endTickList = roundEndEvents.map((e: any) => Number(e.tick))

	const rounds: ParsedRound[] = []

	for (let i = 0; i < roundStartEvents.length; i++) {
		const startTick = Number(roundStartEvents[i].tick)
		const endTick =
			endTickList[i] ??
			Number(roundStartEvents[i + 1]?.tick ?? playbackTicks)

		if (endTick <= startTick) continue

		// player_death's *_team_num fields have proven unreliable (kills render
		// as same-team in the feed) — derive team from this round's tick data
		// instead, which the HUD already shows correctly.
		const steamTeam = new Map<string, 'CT' | 'T'>()
		for (let tick = startTick; tick <= endTick; tick += TICK_STRIDE) {
			for (const p of tickPlayerMap.get(tick) ?? [])
				steamTeam.set(p.steamId, p.team)
		}

		const endEvt = roundEndEvents[i]
		const winnerTeam: 'CT' | 'T' | undefined = endEvt
			? toTeam(Number(endEvt.winner))
			: undefined
		const winReason: string | undefined =
			endEvt?.reason != null ? String(endEvt.reason) : undefined

		const frames: TickFrame[] = []
		// round_start can land a few ticks ahead of the first sampled tick that
		// actually carries player data (recording gaps at round transitions) —
		// walk forward to the first stride-aligned tick the tick map has, so we
		// don't emit leading frames with an empty players[] (round 7/13 had this).
		let firstSampledTick = Math.ceil(startTick / TICK_STRIDE) * TICK_STRIDE
		while (
			firstSampledTick <= endTick &&
			!tickPlayerMap.has(firstSampledTick)
		) {
			firstSampledTick += TICK_STRIDE
		}
		for (
			let tick = firstSampledTick;
			tick <= endTick;
			tick += TICK_STRIDE
		) {
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
				attackerTeam:
					steamTeam.get(String(e.attacker_steamid ?? '')) ??
					toTeam(Number(e.attacker_team_num ?? 0)),
				victimName: String(e.user_name ?? ''),
				victimSteamId: String(e.user_steamid ?? ''),
				victimTeam:
					steamTeam.get(String(e.user_steamid ?? '')) ??
					toTeam(Number(e.user_team_num ?? 0)),
				weapon: String(e.weapon ?? ''),
				headshot: Boolean(e.headshot)
			}))

		const bombEvents: BombEvent[] = []
		const inRound = (e: any) =>
			Number(e.tick) >= startTick && Number(e.tick) <= endTick

		for (const e of allBombDrops.filter(inRound)) {
			const tick = Number(e.tick)
			const pos = positionAt(
				positionIndex,
				String(e.user_steamid ?? ''),
				tick
			)
			bombEvents.push({
				tick,
				type: 'dropped',
				...(pos ? { x: pos.x, y: pos.y } : {})
			})
		}
		for (const e of allBombPlants.filter(inRound)) {
			const tick = Number(e.tick)
			const pos = positionAt(
				positionIndex,
				String(e.user_steamid ?? ''),
				tick
			)
			bombEvents.push({
				tick,
				type: 'planted',
				site: String(e.site ?? ''),
				...(pos ? { x: pos.x, y: pos.y } : {})
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
