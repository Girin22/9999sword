import { describe, expect, it } from 'vitest';
import { freshSave, loadSave, persistSave, SAVE_KEY } from '../src/sim/save';

describe('single-key save', () => {
  it('round trips one JSON document', () => {
    const memory = new Map<string, string>(); const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value) };
    const save = freshSave(); save.shards = 77; persistSave(save, storage); expect([...memory.keys()]).toEqual([SAVE_KEY]); expect(loadSave(storage).shards).toBe(77);
  });
});
