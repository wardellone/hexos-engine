// ============================================================
// HEXOS TCG — Corpus Adapter
// Converts raw JSON corpus format → engine CardDefinition types
// ============================================================

import { CardDefinition, Ability, EffectOp, Cost, TriggerEvent, Affinity } from '../types/card';

// ---- Raw corpus types (as-is from hexos_corpus_full.json) ---

interface RawStat {
  atk?: number;
  core?: number;
  shield?: number;
}

interface RawCostSacrifice {
  count: number;
  what?: string;
  from?: string[];
}

interface RawCost {
  sacrifice?: RawCostSacrifice;
  banish?: { count: number; from?: string[] };
  return?: { count: number; from?: string[] };
  drawn?: number;
  curse?: number;
}

interface RawTarget {
  who: string;
  cardType?: string[];
  archetype?: string;
  zone?: string;
  count?: number;
}

interface RawEffect {
  op: string;
  target?: RawTarget;
  amount?: number;
  zoneFrom?: string;
  zoneTo?: string;
  stat?: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

interface RawTrigger {
  event: string;
  who?: string;
  filter?: string;
}

interface RawAbility {
  kind: string;
  name: string;
  text: string;
  speed?: string;
  frequency?: string;
  trigger?: RawTrigger;
  condition?: string;
  cost?: RawCost;
  effect?: RawEffect[];
  maxPerTurn?: number;
}

interface RawCard {
  defId: string;
  displayName: string;
  archetype: string;
  affinity: string;
  type: string;
  cost?: Record<string, unknown>;
  stats?: RawStat;
  abilities: RawAbility[];
  flags?: string[];
  designNotes?: string;
  keywords?: string[];
}

// ---- Adapter -----------------------------------------------

export function adaptCard(raw: RawCard): CardDefinition {
  return {
    defId: raw.defId,
    displayName: raw.displayName,
    type: adaptType(raw.type),
    affinity: adaptAffinity(raw.archetype ?? raw.affinity),
    atk: raw.stats?.atk,
    core: raw.stats?.core,
    shield: raw.stats?.shield,
    deckLimit: 3, // Default; could add to schema later
    abilities: raw.abilities.map((ab, idx) => adaptAbility(ab, raw.defId, idx)),
    keywords: raw.flags ?? raw.keywords ?? [],
    designNotes: raw.designNotes,
  };
}

function adaptType(raw: string): CardDefinition['type'] {
  const map: Record<string, CardDefinition['type']> = {
    COLOSSUS: 'COLOSSUS',
    RITO: 'RITO',
    VETO: 'VETO',
    VASSAL: 'VASSAL',
    PILLAR: 'PILLAR',
    VOW: 'VETO', // VOW maps to VETO (instant response cards)
  };
  return map[raw.toUpperCase()] ?? 'VASSAL';
}

function adaptAffinity(raw: string): Affinity {
  const map: Record<string, Affinity> = {
    DINO: 'DINO',
    IMPULSE: 'DINO', // Some cards use affinity=IMPULSE but archetype=DINO
    ZEUS: 'ZEUS',
    OLYMPUS: 'ZEUS',
    ROME: 'ROME',
    EMPIRE: 'ROME',
    VOID: 'VOID',
    ECLIPSE: 'VOID',
    TOMB: 'TOMB',
    DESERT: 'TOMB',
    NORD: 'NORD',
    FROST: 'NORD',
    ARTS: 'ARTS',
    ALCHEMY: 'ARTS',
    GOLD: 'GOLD',
    TREASURE: 'GOLD',
    AZTEC: 'AZTEC',
    SUN: 'AZTEC',
    MIST: 'MIST',
    SHADOW: 'MIST',
    BABEL: 'BABEL',
    TOWER: 'BABEL',
    TRENCH: 'TRENCH',
    DEEP: 'TRENCH',
  };
  return map[raw.toUpperCase()] ?? 'DINO';
}

function adaptAbility(raw: RawAbility, defId: string, idx: number): Ability {
  return {
    abilityId: `${defId}_ab${idx}`,
    name: raw.name,
    text: raw.text,
    type: adaptAbilityType(raw.kind),
    trigger: adaptTrigger(raw.trigger),
    cost: adaptCost(raw.cost),
    effects: adaptEffects(raw.effect ?? []),
    once: raw.frequency === 'ONCE_PER_TURN' || raw.maxPerTurn === 1,
    designNotes: raw.condition ?? undefined,
  };
}

function adaptAbilityType(kind: string): Ability['type'] {
  const map: Record<string, Ability['type']> = {
    TRIGGERED: 'TRIGGERED',
    ACTIVATED: 'ACTIVATED',
    STATIC: 'PASSIVE',
    PASSIVE: 'PASSIVE',
    VOW: 'INSTANT',
    INSTANT: 'INSTANT',
    CONTINUOUS: 'PASSIVE',
  };
  return map[kind.toUpperCase()] ?? 'ACTIVATED';
}

function adaptTrigger(raw?: RawTrigger): TriggerEvent | undefined {
  if (!raw) return undefined;

  const map: Record<string, TriggerEvent> = {
    ON_ENTER_FIELD: 'ON_ENTER_FIELD',
    ON_DEATH: 'ON_DEATH',
    ON_ATTACK_DECLARED: 'ON_ATTACK_DECLARED',
    ON_ATTACK_RESOLVED: 'ON_ATTACK_RESOLVED',
    ON_DAMAGE_DEALT: 'ON_DAMAGE_DEALT',
    ON_DAMAGE_RECEIVED: 'ON_DAMAGE_RECEIVED',
    ON_DRAW: 'ON_DRAW',
    ON_DISCARD: 'ON_DISCARD',
    ON_CARD_TO_ABYSS: 'ON_CARD_TO_ABYSS',
    ON_CARD_TO_HAND: 'ON_CARD_TO_HAND',
    ON_CARD_TO_THRONE: 'ON_CARD_TO_THRONE',
    ON_CARD_TO_SEAL: 'ON_CARD_TO_SEAL',
    ON_TURN_START: 'ON_TURN_START',
    ON_TURN_END: 'ON_TURN_END',
    ON_OPPONENT_ACTIVATE_RITO: 'ON_OPPONENT_ACTIVATE_RITO',
    ON_OPPONENT_ACTIVATE_VOW: 'ON_OPPONENT_ACTIVATE_VOW',
    ON_GAME_START: 'ON_GAME_START',
    ON_COLOSSUS_SUMMONED: 'ON_COLOSSUS_SUMMONED',
    ON_VASSAL_ACTIVATED: 'ON_VASSAL_ACTIVATED',
    ON_ECLIPSE_ACTIVATED: 'ON_ECLIPSE_ACTIVATED',
    // Map some corpus-specific events to best equivalent
    ON_DESTROYS_MONSTER: 'ON_ATTACK_RESOLVED',
    ON_SACRIFICED: 'ON_CARD_TO_ABYSS',
    ON_POSITION_CHANGE: 'ON_ATTACK_DECLARED', // Workaround (per design notes)
    ON_OPPONENT_ACTIVATE_VASSAL: 'ON_VASSAL_ACTIVATED',
  };

  const key = raw.event.toUpperCase().replace(/ /g, '_');
  return map[key] ?? 'ON_ENTER_FIELD';
}

function adaptCost(raw?: RawCost): Cost | undefined {
  if (!raw) return { type: 'NONE' };

  if (raw.sacrifice) {
    return {
      type: 'SACRIFICE',
      count: raw.sacrifice.count,
      optional: false,
    };
  }
  if (raw.banish) {
    return {
      type: 'BANISH',
      count: raw.banish.count,
      from: 'ABYSS',
    };
  }
  if (raw.return) {
    return {
      type: 'RETURN',
      count: raw.return.count,
      from: 'FIELD',
    };
  }
  if (raw.drawn) {
    return {
      type: 'DRAWN',
      count: raw.drawn,
    };
  }
  // curse cost (lose life / gain curse) — treated as no mechanical cost for now
  return { type: 'NONE' };
}

function adaptEffects(raw: RawEffect[]): EffectOp[] {
  return raw.map(e => adaptEffect(e)).filter(Boolean) as EffectOp[];
}

function adaptEffect(raw: RawEffect): EffectOp | null {
  const target = adaptTarget(raw.target);

  switch (raw.op.toUpperCase()) {
    case 'DRAW':
      return { op: 'DRAW', target, value: raw.amount ?? 1 };

    case 'MILL':
      return { op: 'MILL', target, value: raw.amount ?? 1 };

    case 'DESTROY':
      return { op: 'DESTROY', target };

    case 'BANISH':
      return { op: 'BANISH', target };

    case 'MOVE_ZONE':
      return {
        op: 'MOVE_ZONE',
        target,
        zone: adaptZone(raw.zoneFrom) ?? 'FIELD',
        toZone: adaptZone(raw.zoneTo) ?? 'ABYSS',
        optional: (raw.params?.optional as boolean) ?? false,
      };

    case 'MODIFY_STAT':
    case 'BUFF':
    case 'DEBUFF':
      return {
        op: 'MODIFY_STAT',
        target,
        stat: adaptStat(raw.stat ?? 'atk'),
        value: raw.amount ?? 0,
        duration: 'PERMANENT',
      };

    case 'SET_STAT':
      return {
        op: 'SET_STAT',
        target,
        stat: adaptStat(raw.stat ?? 'atk'),
        value: raw.amount ?? 0,
      };

    case 'GRANT_KEYWORD':
    case 'ADD_KEYWORD':
      return { op: 'GRANT_KEYWORD', target, keyword: raw.keyword ?? '' };

    case 'SPECIAL_SUMMON':
    case 'SUMMON':
      return { op: 'SPECIAL_SUMMON', target };

    case 'RETURN_TO_HAND':
      return { op: 'RETURN_TO_HAND', target };

    case 'SHUFFLE_DECK':
      return { op: 'SHUFFLE_DECK', target };

    case 'NEGATE':
      return { op: 'NEGATE', target };

    case 'GAIN_LIFE':
      return { op: 'GAIN_LIFE', target, value: raw.amount ?? 0 };

    case 'LOSE_LIFE':
    case 'DEAL_DAMAGE':
      return { op: 'DEAL_DAMAGE', target, value: raw.amount ?? 0 };

    case 'GAIN_CURSE':
      return { op: 'GAIN_CURSE', target };

    case 'REMOVE_CURSE':
      return { op: 'REMOVE_CURSE', target };

    case 'SEARCH':
    case 'SEARCH_DECK':
      return { op: 'SEARCH_DECK', target };

    case 'GRANT_ATTACK':
      // Not yet implemented — log and skip
      return null;

    default:
      return null;
  }
}

function adaptTarget(raw?: RawTarget): EffectOp['target'] {
  if (!raw) return 'SELF';

  const who = raw.who?.toUpperCase();
  const zone = raw.zone?.toUpperCase();

  if (who === 'SELF' && !zone) return 'SELF';
  if (who === 'SELF' && zone === 'FIELD') return 'FIELD_OWN';
  if (who === 'SELF' && zone === 'ABYSS') return 'ABYSS_OWN';
  if (who === 'SELF' && zone === 'HAND') return 'HAND_OWN';
  if (who === 'OPPONENT' && zone === 'FIELD') return 'FIELD_OPPONENT';
  if (who === 'OPPONENT' && zone === 'ABYSS') return 'ABYSS_OPPONENT';
  if (who === 'OPPONENT' && zone === 'HAND') return 'HAND_OPPONENT';
  if (who === 'OPPONENT') return 'OPPONENT';
  if (who === 'ALL' && zone === 'FIELD') return 'ALL_FIELD';
  if (who === 'ANY') return 'FIELD_ANY';

  return 'SELF';
}

function adaptZone(raw?: string): EffectOp['zone'] {
  if (!raw) return undefined;
  const map: Record<string, EffectOp['zone']> = {
    THRONE: 'THRONE',
    HAND: 'HAND',
    FIELD: 'FIELD',
    ABYSS: 'ABYSS',
    SEAL: 'SEAL',
    GRAVEYARD: 'ABYSS',
    DECK: 'THRONE',
    BANISH: 'SEAL',
  };
  return map[raw.toUpperCase()];
}

function adaptStat(raw: string): 'ATK' | 'CORE' | 'SHIELD' {
  const map: Record<string, 'ATK' | 'CORE' | 'SHIELD'> = {
    ATK: 'ATK', CORE: 'CORE', SHIELD: 'SHIELD',
    OFFENSE: 'ATK', DEFENSE: 'SHIELD',
    atk: 'ATK', core: 'CORE', shield: 'SHIELD',
  };
  return map[raw] ?? 'ATK';
}
