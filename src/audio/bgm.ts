import Phaser from 'phaser';
import { session } from '../session';
import { persistSave } from '../sim/save';
import { makeButton } from '../ui/components';

export type BgmTrack = 'bgm-title' | 'bgm-lobby' | 'bgm-ingame';

const tracks: BgmTrack[] = ['bgm-title', 'bgm-lobby', 'bgm-ingame'];
const volume: Record<BgmTrack, number> = { 'bgm-title': 0.42, 'bgm-lobby': 0.36, 'bgm-ingame': 0.38 };
let desiredTrack: BgmTrack | null = null;
let activeTrack: BgmTrack | null = null;

const stopTracks = (scene: Phaser.Scene): void => {
  for (const key of tracks) scene.sound.stopByKey(key);
  activeTrack = null;
};

export function playBgm(scene: Phaser.Scene, track: BgmTrack, force = false): void {
  desiredTrack = track;
  if (!session.save.sound) {
    stopTracks(scene);
    return;
  }
  const current = scene.sound.get(track);
  if (!force && activeTrack === track && current?.isPlaying) return;
  stopTracks(scene);
  scene.sound.play(track, { loop: true, volume: volume[track] });
  activeTrack = track;
}

export function toggleBgm(scene: Phaser.Scene, track: BgmTrack): boolean {
  session.save.sound = !session.save.sound;
  persistSave(session.save);
  if (session.save.sound) playBgm(scene, track, true);
  else stopTracks(scene);
  return session.save.sound;
}

export function addBgmToggle(scene: Phaser.Scene, track: BgmTrack, x = 985, y = 92, width = 140): Phaser.GameObjects.Container {
  playBgm(scene, track);
  const holder: { label?: Phaser.GameObjects.Text } = {};
  const button = makeButton(scene, x, y, session.save.sound ? '♫' : '♫×', () => {
    const enabled = toggleBgm(scene, track);
    holder.label?.setText(enabled ? '♫' : '♫×');
  }, { width, height: 98, fill: 0xdceff4, fontSize: session.save.sound ? 39 : 31 });
  holder.label = button.list.find((child) => child instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;
  scene.input.once('pointerdown', () => {
    if (desiredTrack === track && session.save.sound && !scene.sound.get(track)?.isPlaying) playBgm(scene, track, true);
  });
  return button;
}
