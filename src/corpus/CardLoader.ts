// ============================================================
// HEXOS TCG — Card Loader
// Loads card definitions from the JSON corpus
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { CardDefinition, Affinity } from '../types/card';
import { adaptCard } from './CorpusAdapter';

let corpus: CardDefinition[] | null = null;
const corpusPath = path.join(__dirname, 'cards.json');

export function loadCorpus(): CardDefinition[] {
  if (corpus) return corpus;
  const raw = JSON.parse(fs.readFileSync(corpusPath, 'utf-8'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corpus = (raw as any[]).map(adaptCard);
  return corpus;
}

export function getCard(defId: string): CardDefinition {
  const cards = loadCorpus();
  const card = cards.find(c => c.defId === defId);
  if (!card) throw new Error(`Card not found: ${defId}`);
  return card;
}

export function getArchetype(affinity: Affinity): CardDefinition[] {
  return loadCorpus().filter(c => c.affinity === affinity);
}

export function buildDeck(defIds: string[]): CardDefinition[] {
  return defIds.map(id => getCard(id));
}

// ---- Standard archetype decks for testing ----------------
export function getDinoDeck(): CardDefinition[] { return getArchetype('DINO'); }
export function getRomeDeck(): CardDefinition[] { return getArchetype('ROME'); }
export function getTombDeck(): CardDefinition[] { return getArchetype('TOMB'); }
