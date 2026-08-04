/** Small deterministic PRNG used only by tests. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Installs a seeded Math.random and always restores it, even after failure. */
export function withSeed<T>(seed: number, run: () => T): T {
  const original = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return run();
  } finally {
    Math.random = original;
  }
}
