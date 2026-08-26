export interface RandomSource {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

export class SeededRng implements RandomSource {
  private state: number;
  constructor(seed = Date.now()) { this.state = seed >>> 0 || 0x6d2b79f5; }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty list');
    return items[this.int(0, items.length - 1)]!;
  }
}

export const sequenceRng = (values: number[]): RandomSource => {
  let index = 0;
  const next = () => values[index++ % values.length] ?? 0;
  return { next, int: (min, max) => Math.floor(next() * (max - min + 1)) + min, pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]! };
};
