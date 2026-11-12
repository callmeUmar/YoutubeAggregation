/** Seeded randomness so every demo analysis is reproducible from its inputs. */

/** FNV-1a 32-bit hash. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number;
  between(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Index chosen with probability proportional to its weight. */
  weightedIndex(weights: readonly number[]): number;
  id(length: number): string;
}

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** mulberry32: tiny, fast, good enough for mock data. */
export function createRng(seed: number | string): Rng {
  let state = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    between: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('pick() from an empty list');
      return item;
    },
    weightedIndex: (weights) => {
      const total = weights.reduce((sum, w) => sum + w, 0);
      let roll = next() * total;
      for (let i = 0; i < weights.length; i += 1) {
        roll -= weights[i] ?? 0;
        if (roll < 0) return i;
      }
      return weights.length - 1;
    },
    id: (length) => {
      let out = '';
      for (let i = 0; i < length; i += 1) out += ID_ALPHABET[Math.floor(next() * ID_ALPHABET.length)];
      return out;
    },
  };
  return rng;
}
