// ============================================================
// HEXOS TCG — Card Type Definitions
// ============================================================

export type CardType = 'COLOSSUS' | 'RITO' | 'VETO' | 'VASSAL' | 'PILLAR';
export type Affinity = 'DINO' | 'ZEUS' | 'ROME' | 'VOID' | 'TOMB' | 'NORD' | 'ARTS' | 'GOLD' | 'AZTEC' | 'MIST' | 'BABEL' | 'TRENCH';
export type Position = 'ATTACK' | 'GUARD';
export type ZoneType = 'THRONE' | 'HAND' | 'FIELD' | 'ABYSS' | 'SEAL';

// ---- Cost ---------------------------------------------------
export interface CostDrawn {
  type: 'DRAWN';
  count: number;
}
export interface CostSacrifice {
  type: 'SACRIFICE';
  count: number;
  optional?: boolean;
}
export interface CostReturn {
  type: 'RETURN';
  count: number;
  from: ZoneType;
}
export interface CostBanish {
  type: 'BANISH';
  count: number;
  from: ZoneType;
}
export interface CostNone {
  type: 'NONE';
}

export type Cost =
  | CostDrawn
  | CostSacrifice
  | CostReturn
  | CostBanish
  | CostNone;

// ---- Trigger Events -----------------------------------------
export type TriggerEvent =
  | 'ON_ENTER_FIELD'
  | 'ON_DEATH'
  | 'ON_ATTACK_DECLARED'
  | 'ON_ATTACK_RESOLVED'
  | 'ON_DAMAGE_DEALT'
  | 'ON_DAMAGE_RECEIVED'
  | 'ON_DRAW'
  | 'ON_DISCARD'
  | 'ON_CARD_TO_ABYSS'
  | 'ON_CARD_TO_HAND'
  | 'ON_CARD_TO_THRONE'
  | 'ON_CARD_TO_SEAL'
  | 'ON_OPPONENT_ACTIVATE_RITO'
  | 'ON_OPPONENT_ACTIVATE_VOW'
  | 'ON_CONTROLLER_ACTIVATE_RITO'
  | 'ON_TURN_START'
  | 'ON_TURN_END'
  | 'ON_PHASE_AWAKENING'
  | 'ON_PHASE_STRATEGIC'
  | 'ON_PHASE_CONFLICT'
  | 'ON_PHASE_TERMINAL'
  | 'ON_KEYWORD_GAINED'
  | 'ON_STAT_CHANGE'
  | 'ON_CURSE_GAINED'
  | 'ON_CURSE_REMOVED'
  | 'ON_ECLIPSE_ACTIVATED'
  | 'ON_COLOSSUS_SUMMONED'
  | 'ON_VASSAL_ACTIVATED'
  | 'ON_PILLAR_ACTIVATED'
  | 'ON_GAME_START'
  | 'PASSIVE'; // Always-on passive effects

// ---- Effect Operations --------------------------------------
export type EffectOpType =
  | 'DRAW'
  | 'MILL'
  | 'MOVE_ZONE'
  | 'DESTROY'
  | 'BANISH'
  | 'SET_STAT'
  | 'MODIFY_STAT'
  | 'GRANT_KEYWORD'
  | 'REMOVE_KEYWORD'
  | 'NEGATE'
  | 'GAIN_LIFE'
  | 'LOSE_LIFE'
  | 'DEAL_DAMAGE'
  | 'SET_POSITION'
  | 'GAIN_CURSE'
  | 'REMOVE_CURSE'
  | 'COPY_EFFECT'
  | 'SEARCH_DECK'
  | 'SPECIAL_SUMMON'
  | 'RETURN_TO_HAND'
  | 'SHUFFLE_DECK'
  | 'LOOK_AT_HAND'
  | 'SWAP_CONTROL'
  | 'PREVENT_ATTACK';

export type TargetType =
  | 'SELF'
  | 'OWNER'
  | 'OPPONENT'
  | 'ANY_PLAYER'
  | 'FIELD_OWN'
  | 'FIELD_OPPONENT'
  | 'FIELD_ANY'
  | 'ABYSS_OWN'
  | 'ABYSS_OPPONENT'
  | 'HAND_OWN'
  | 'HAND_OPPONENT'
  | 'ALL_FIELD'
  | 'ALL_OPPONENT_FIELD'
  | 'ALL_OWN_FIELD';

export interface EffectCondition {
  type: 'HAS_KEYWORD' | 'STAT_GTE' | 'STAT_LTE' | 'ZONE_COUNT' | 'HAS_CURSE' | 'IS_AFFINITY' | 'ECLIPSE_ACTIVE';
  keyword?: string;
  stat?: 'ATK' | 'CORE' | 'SHIELD';
  value?: number;
  zone?: ZoneType;
  affinity?: Affinity;
}

export interface EffectOp {
  op: EffectOpType;
  target: TargetType;
  value?: number;
  stat?: 'ATK' | 'CORE' | 'SHIELD';
  keyword?: string;
  zone?: ZoneType;
  toZone?: ZoneType;
  filter?: Partial<{ affinity: Affinity; type: CardType; hasKeyword: string }>;
  condition?: EffectCondition;
  optional?: boolean;
  duration?: 'PERMANENT' | 'UNTIL_END_OF_TURN' | 'WHILE_ON_FIELD';
}

// ---- Ability ------------------------------------------------
export interface Ability {
  abilityId: string;
  name: string;
  text: string;
  type: 'TRIGGERED' | 'ACTIVATED' | 'PASSIVE' | 'INSTANT';
  trigger?: TriggerEvent;
  cost?: Cost;
  effects: EffectOp[];
  once?: boolean;           // Once per turn
  designNotes?: string;
}

// ---- Card Definition (from JSON corpus) ---------------------
export interface CardDefinition {
  defId: string;
  displayName: string;
  type: CardType;
  affinity: Affinity;
  atk?: number;
  core?: number;
  shield?: number;
  deckLimit: number;
  abilities: Ability[];
  keywords?: string[];
  designNotes?: string;
}
