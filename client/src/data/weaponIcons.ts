// Sprite rects into /weapon_icons.png (579x582). The sheet ships with no
// per-icon labels, so each rect below is matched to a specific CS2 weapon by
// its silhouette's distinguishing features (suppressor, revolver cylinder,
// bullpup carry handle, AK-pattern furniture, scope size, etc).
export const ICON_SHEET = '/weapon_icons.png'
export const ICON_SHEET_SIZE = { w: 579, h: 582 }

export interface IconRect {
	x: number
	y: number
	w: number
	h: number
}

export const WEAPON_ICON_RECTS = {
	pistol_deagle: { x: 0, y: 0, w: 72, h: 46 },
	pistol_elite: { x: 76, y: 0, w: 56, h: 46 },
	pistol_p2000: { x: 133, y: 0, w: 55, h: 46 },
	pistol_glock: { x: 258, y: 0, w: 58, h: 46 },
	pistol_tec9: { x: 0, y: 243, w: 72, h: 40 },
	pistol_p250: { x: 75, y: 243, w: 59, h: 40 },
	pistol_fiveseven: { x: 137, y: 243, w: 56, h: 40 },
	pistol_usp: { x: 0, y: 423, w: 107, h: 40 },
	pistol_cz75: { x: 110, y: 423, w: 64, h: 40 },
	pistol_revolver: { x: 177, y: 423, w: 84, h: 40 },

	smg_mac10: { x: 196, y: 243, w: 69, h: 40 },
	smg_compact: { x: 289, y: 121, w: 58, h: 43 },
	smg_mp9: { x: 256, y: 180, w: 89, h: 45 },
	smg_p90: { x: 130, y: 180, w: 121, h: 45 },
	smg_mp5: { x: 0, y: 300, w: 94, h: 45 },

	rifle_ak47: { x: 329, y: 0, w: 128, h: 46 },
	rifle_m4a4: { x: 0, y: 121, w: 122, h: 43 },
	rifle_m4a1s: { x: 126, y: 121, w: 160, h: 43 },
	rifle_famas: { x: 161, y: 61, w: 106, h: 43 },
	rifle_galil: { x: 232, y: 300, w: 121, h: 45 },
	rifle_aug: { x: 461, y: 0, w: 108, h: 46 },
	rifle_sg553: { x: 269, y: 61, w: 131, h: 43 },

	sniper_awp: { x: 0, y: 61, w: 157, h: 43 },
	sniper_ssg08: { x: 405, y: 61, w: 138, h: 43 },
	sniper_g3sg1: { x: 98, y: 300, w: 128, h: 45 },
	sniper_scar20: { x: 357, y: 300, w: 145, h: 45 },

	shotgun_nova: { x: 0, y: 180, w: 123, h: 46 },
	shotgun_xm1014: { x: 462, y: 180, w: 118, h: 46 },

	lmg_negev: { x: 349, y: 180, w: 108, h: 46 },

	he: { x: 104, y: 359, w: 19, h: 44 },
	flash: { x: 127, y: 359, w: 30, h: 44 },
	smoke: { x: 162, y: 359, w: 20, h: 44 },
	molotov: { x: 187, y: 359, w: 29, h: 44 },
	decoy: { x: 221, y: 359, w: 37, h: 44 },
	incendiary: { x: 263, y: 359, w: 20, h: 44 },
	c4: { x: 289, y: 359, w: 42, h: 44 },

	knife: { x: 0, y: 359, w: 99, h: 44 },
	kevlar: { x: 208, y: 543, w: 32, h: 38 },
	kevlarHelmet: { x: 244, y: 543, w: 32, h: 38 },
	defuseKit: { x: 278, y: 543, w: 46, h: 39 }
} satisfies Record<string, IconRect>

export type WeaponIconKey = keyof typeof WEAPON_ICON_RECTS

// Normalizes every sprite to the same on-screen height so wildly different
// silhouette aspect ratios (long rifles vs. squat grenades) sit on one baseline.
export function spriteStyle(
	key: WeaponIconKey | null | undefined,
	heightPx: number
) {
	if (!key) return null
	const r = WEAPON_ICON_RECTS[key]
	const scale = heightPx / r.h
	return {
		width: `${r.w * scale}px`,
		height: `${heightPx}px`,
		backgroundImage: `url(${ICON_SHEET})`,
		backgroundPosition: `-${r.x * scale}px -${r.y * scale}px`,
		backgroundSize: `${ICON_SHEET_SIZE.w * scale}px ${ICON_SHEET_SIZE.h * scale}px`
	}
}

const PRIMARY_PREFIXES = ['rifle_', 'smg_', 'sniper_', 'shotgun_', 'lmg_']

function isPrimary(key: WeaponIconKey): boolean {
	return PRIMARY_PREFIXES.some((p) => key.startsWith(p))
}

function isSecondary(key: WeaponIconKey): boolean {
	return key.startsWith('pistol_')
}

export type GrenadeKind =
	| 'he'
	| 'flash'
	| 'smoke'
	| 'molotov'
	| 'incendiary'
	| 'decoy'

const GRENADE_ICON_KEYS: ReadonlySet<WeaponIconKey> = new Set([
	'he',
	'flash',
	'smoke',
	'molotov',
	'incendiary',
	'decoy'
])

// Inventory slot display names (from demoparser2 `inventory`) -> icon. Each
// distinct weapon gets its own icon so loadouts read at a glance like a real
// observer HUD, rather than every pistol/rifle collapsing to one silhouette.
const NAME_TO_ICON: Record<string, WeaponIconKey> = {
	'Desert Eagle': 'pistol_deagle',
	'Dual Berettas': 'pistol_elite',
	P2000: 'pistol_p2000',
	'Glock-18': 'pistol_glock',
	'Tec-9': 'pistol_tec9',
	P250: 'pistol_p250',
	'Five-SeveN': 'pistol_fiveseven',
	'USP-S': 'pistol_usp',
	'CZ75-Auto': 'pistol_cz75',
	'R8 Revolver': 'pistol_revolver',

	'MAC-10': 'smg_mac10',
	MP9: 'smg_mp9',
	P90: 'smg_p90',
	'MP5-SD': 'smg_mp5',
	MP7: 'smg_compact',
	'UMP-45': 'smg_compact',

	'AK-47': 'rifle_ak47',
	M4A4: 'rifle_m4a4',
	'M4A1-S': 'rifle_m4a1s',
	FAMAS: 'rifle_famas',
	'Galil AR': 'rifle_galil',
	AUG: 'rifle_aug',
	'SG 553': 'rifle_sg553',

	AWP: 'sniper_awp',
	'SSG 08': 'sniper_ssg08',
	G3SG1: 'sniper_g3sg1',
	'SCAR-20': 'sniper_scar20',

	Nova: 'shotgun_nova',
	XM1014: 'shotgun_xm1014',
	'MAG-7': 'shotgun_nova',
	'Sawed-Off': 'shotgun_nova',

	Negev: 'lmg_negev',
	M249: 'lmg_negev',

	'High Explosive Grenade': 'he',
	Flashbang: 'flash',
	'Smoke Grenade': 'smoke',
	Molotov: 'molotov',
	'Incendiary Grenade': 'incendiary',
	'Decoy Grenade': 'decoy',
	'C4 Explosive': 'c4'
}

// `player_death.weapon` reports short internal codes rather than display
// names (e.g. "m4a1_silencer", "usp_silencer") — map those too so the kill
// feed can show icons instead of raw weapon strings.
const CODE_TO_ICON: Record<string, WeaponIconKey> = {
	deagle: 'pistol_deagle',
	elite: 'pistol_elite',
	hkp2000: 'pistol_p2000',
	glock: 'pistol_glock',
	tec9: 'pistol_tec9',
	p250: 'pistol_p250',
	fiveseven: 'pistol_fiveseven',
	usp_silencer: 'pistol_usp',
	usp: 'pistol_usp',
	cz75a: 'pistol_cz75',
	revolver: 'pistol_revolver',
	r8_revolver: 'pistol_revolver',

	mac10: 'smg_mac10',
	mp9: 'smg_mp9',
	p90: 'smg_p90',
	mp5sd: 'smg_mp5',
	mp7: 'smg_compact',
	ump45: 'smg_compact',
	bizon: 'smg_compact',

	ak47: 'rifle_ak47',
	m4a1: 'rifle_m4a4',
	m4a1_silencer: 'rifle_m4a1s',
	famas: 'rifle_famas',
	galilar: 'rifle_galil',
	aug: 'rifle_aug',
	sg556: 'rifle_sg553',

	awp: 'sniper_awp',
	ssg08: 'sniper_ssg08',
	g3sg1: 'sniper_g3sg1',
	scar20: 'sniper_scar20',

	nova: 'shotgun_nova',
	xm1014: 'shotgun_xm1014',
	mag7: 'shotgun_nova',
	sawedoff: 'shotgun_nova',

	negev: 'lmg_negev',
	m249: 'lmg_negev',

	hegrenade: 'he',
	flashbang: 'flash',
	smokegrenade: 'smoke',
	molotov: 'molotov',
	incgrenade: 'incendiary',
	inferno: 'incendiary',
	decoy: 'decoy',
	c4: 'c4',
	planted_c4: 'c4'
}

function isKnifeName(name: string): boolean {
	const n = name.toLowerCase()
	return (
		n === 'knife' ||
		n === 'knife_t' ||
		n.includes('knife') ||
		n.includes('bayonet') ||
		n.includes('karambit') ||
		n.includes('daggers')
	)
}

export function iconForWeapon(name: string): WeaponIconKey | null {
	if (isKnifeName(name)) return 'knife'
	return NAME_TO_ICON[name] ?? null
}

export function iconForWeaponCode(code: string): WeaponIconKey | null {
	const c = (code ?? '').toLowerCase()
	if (c.startsWith('knife')) return 'knife'
	if (c === 'taser') return null
	return CODE_TO_ICON[c] ?? null
}

export function grenadeIconKind(name: string): GrenadeKind | null {
	const icon = NAME_TO_ICON[name]
	return icon && GRENADE_ICON_KEYS.has(icon) ? (icon as GrenadeKind) : null
}

export interface InventoryLoadout {
	primary: string | null
	secondary: string | null
	grenades: string[]
	hasZeus: boolean
}

export function categorizeInventory(inventory: string[]): InventoryLoadout {
	let primary: string | null = null
	let secondary: string | null = null
	const grenades: string[] = []
	let hasZeus = false

	for (const item of inventory) {
		if (item === 'Zeus x27') {
			hasZeus = true
			continue
		}
		const icon = iconForWeapon(item)
		if (!icon) continue
		if (GRENADE_ICON_KEYS.has(icon)) {
			grenades.push(item)
		} else if (isSecondary(icon)) {
			secondary = item
		} else if (isPrimary(icon)) {
			primary = item
		}
	}

	return { primary, secondary, grenades, hasZeus }
}
