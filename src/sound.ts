/**
 * 効果音（Web Audio で合成。音声ファイルは使わない）
 * 教室で急に音が出ないよう、初期はオフ。オン／オフは localStorage に覚える。
 */

import { safeGetStorage, safeSetStorage } from './storage';

const STORAGE_KEY = 'ball_coaster_sound';

let ctx: AudioContext | null = null;
let enabled = safeGetStorage<boolean>(STORAGE_KEY, false);
let rollGain: GainNode | null = null;
let rollSource: AudioBufferSourceNode | null = null;

export function isSoundEnabled() {
  return enabled;
}

// ボタンを押したとき（ユーザー操作の中）で呼ぶ。ブラウザの自動再生の制限のため
export function setSoundEnabled(on: boolean) {
  enabled = on;
  safeSetStorage(STORAGE_KEY, on);
  if (on) {
    ensureContext();
  } else {
    stopRolling();
  }
}

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBuffer(ac: AudioContext, seconds: number) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// 転がる音：低めのノイズを流し続け、速さで大きさを変える
export function startRolling() {
  if (!enabled) return;
  const ac = ensureContext();
  if (!ac || rollSource) return;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 1);
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
  rollSource = src;
  rollGain = gain;
}

export function updateRolling(speed: number) {
  if (!ctx || !rollGain) return;
  const target = Math.min(0.16, 0.05 * speed);
  rollGain.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
}

export function stopRolling() {
  if (rollGain && ctx) rollGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  const src = rollSource;
  rollSource = null;
  rollGain = null;
  if (src) setTimeout(() => src.stop(), 150);
}

function tone(freq: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
  if (!enabled) return;
  const ac = ensureContext();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// ループに入る「カタン」
export function playClick() {
  tone(900, 0.05, 0.12, 'square');
}

// 発射台を飛び出す「ヒュッ」
export function playLaunch() {
  if (!enabled) return;
  const ac = ensureContext();
  if (!ac) return;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.3);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, ac.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2600, ac.currentTime + 0.25);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.25, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.28);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

// 缶に当たった「カーン」（金属の響き）
export function playHit() {
  tone(1480, 0.7, 0.22, 'sine');
  tone(2290, 0.5, 0.12, 'sine');
  tone(3710, 0.3, 0.06, 'sine');
}

// 床に落ちた「コトン」
export function playThud(volume = 0.3) {
  tone(140, 0.16, volume, 'sine');
  tone(90, 0.2, volume * 0.6, 'triangle');
}

// 得点が入った「ピロン」
export function playScore() {
  tone(988, 0.12, 0.12, 'triangle');
  tone(1319, 0.18, 0.12, 'triangle', 0.08);
}
