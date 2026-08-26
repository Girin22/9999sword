import Phaser from 'phaser';
import { session } from '../session';

/**
 * Small SFX mixer for battle.
 *
 * Per-cue gains were derived from waveform analysis (50 ms window max-RMS) so every
 * cue lands on a target loudness for its role rather than its raw file level:
 *   role target   →  hits −14 dB · swings/shots −12 dB · magic −10 dB · boss −8 dB
 *   file max-RMS  →  attack −6.6 · attack2 −4.1 · shoot −4.9 · magic −15.1
 *                    damaged −8.1 · damaged2 −9.2 · monster_run −6.8 · monster_smash −6.7
 * gain = 10^((target − maxRMS) / 20), capped at 1.0 (magic is already at its peak headroom).
 */
export type SfxCue = 'swing' | 'shoot' | 'magic' | 'hit' | 'bossRun' | 'bossSmash';

interface CueDef {
  /** Audio cache keys; one is picked at random per play. */
  keys: readonly string[];
  /** Per-key gain (same order as keys). */
  gains: readonly number[];
  /** Simultaneous voices allowed for this cue; oldest is stolen beyond that. */
  maxVoices: number;
  /** Retrigger guard so machine-gun events collapse into one audible hit. */
  minIntervalMs: number;
  /** Higher wins when the global voice cap is reached. */
  priority: number;
  /** Random detune range in cents for variety on repeated cues. */
  detune: number;
  /** Ducks lower-priority cues for this long after it fires (ms). */
  duckMs?: number;
}

export const SFX_FILES: Record<string, string> = {
  'sfx-attack': 'assets/audio/sfx/attack.mp3',
  'sfx-attack2': 'assets/audio/sfx/attack2.mp3',
  'sfx-shoot': 'assets/audio/sfx/shoot.mp3',
  'sfx-magic': 'assets/audio/sfx/magic.mp3',
  'sfx-damaged': 'assets/audio/sfx/damaged.mp3',
  'sfx-damaged2': 'assets/audio/sfx/damaged2.mp3',
  'sfx-monster-run': 'assets/audio/sfx/monster_run.mp3',
  'sfx-monster-smash': 'assets/audio/sfx/monster_smash.mp3',
};

const CUES: Record<SfxCue, CueDef> = {
  swing: { keys: ['sfx-attack', 'sfx-attack2'], gains: [0.54, 0.4], maxVoices: 3, minIntervalMs: 70, priority: 2, detune: 80 },
  shoot: { keys: ['sfx-shoot'], gains: [0.44], maxVoices: 3, minIntervalMs: 70, priority: 2, detune: 90 },
  magic: { keys: ['sfx-magic'], gains: [1], maxVoices: 2, minIntervalMs: 250, priority: 3, detune: 40 },
  hit: { keys: ['sfx-damaged', 'sfx-damaged2'], gains: [0.51, 0.58], maxVoices: 4, minIntervalMs: 55, priority: 1, detune: 120 },
  bossRun: { keys: ['sfx-monster-run'], gains: [0.87], maxVoices: 1, minIntervalMs: 400, priority: 5, detune: 0, duckMs: 500 },
  bossSmash: { keys: ['sfx-monster-smash'], gains: [0.86], maxVoices: 2, minIntervalMs: 120, priority: 5, detune: 30, duckMs: 450 },
};

const MASTER = 0.9;
const MAX_VOICES = 8;
/** Gain applied to low-priority cues while a boss cue is ducking them. */
const DUCK_GAIN = 0.45;
/** Each extra voice of the same cue already sounding trims the new one (avoids stacking to a wall of noise). */
const STACK_TRIM = 0.78;

interface Voice { cue: SfxCue; priority: number; sound: Phaser.Sound.BaseSound; startedAt: number }

export class SfxMixer {
  private voices: Voice[] = [];
  private lastPlayed = new Map<SfxCue, number>();
  private duckUntil = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  play(cue: SfxCue, volumeScale = 1): void {
    if (!session.save.sound) return;
    const def = CUES[cue];
    const now = this.scene.time.now;
    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < def.minIntervalMs) return;

    this.prune();
    const sameCue = this.voices.filter((voice) => voice.cue === cue);
    if (sameCue.length >= def.maxVoices) this.stop(sameCue[0]!);
    if (this.voices.length >= MAX_VOICES) {
      const weakest = [...this.voices].sort((a, b) => a.priority - b.priority || a.startedAt - b.startedAt)[0]!;
      if (weakest.priority > def.priority) return;
      this.stop(weakest);
    }

    const index = Math.floor(Math.random() * def.keys.length);
    const key = def.keys[index]!;
    if (!this.scene.cache.audio.exists(key)) return;
    const stackTrim = Math.pow(STACK_TRIM, this.voices.filter((voice) => voice.cue === cue).length);
    const duck = now < this.duckUntil && def.priority < 5 ? DUCK_GAIN : 1;
    const jitter = 0.92 + Math.random() * 0.16;
    const volume = Math.min(1, MASTER * def.gains[index]! * volumeScale * stackTrim * duck * jitter);
    const detune = def.detune ? (Math.random() * 2 - 1) * def.detune : 0;
    const sound = this.scene.sound.add(key, { volume, detune });
    const voice: Voice = { cue, priority: def.priority, sound, startedAt: now };
    sound.once(Phaser.Sound.Events.COMPLETE, () => this.release(voice));
    sound.once(Phaser.Sound.Events.STOP, () => this.release(voice));
    sound.play();
    this.voices.push(voice);
    this.lastPlayed.set(cue, now);
    if (def.duckMs) this.duckUntil = Math.max(this.duckUntil, now + def.duckMs);
  }

  destroy(): void {
    for (const voice of [...this.voices]) this.stop(voice);
    this.voices = [];
  }

  private prune(): void {
    this.voices = this.voices.filter((voice) => voice.sound.isPlaying || voice.sound.isPaused);
  }

  private stop(voice: Voice): void {
    voice.sound.stop();
    this.release(voice);
  }

  private release(voice: Voice): void {
    this.voices = this.voices.filter((entry) => entry !== voice);
    if (!voice.sound.isPlaying) voice.sound.destroy();
  }
}
