/**
 * Generates short mono PCM WAVs for bundled SFX (no external assets).
 * Run: node scripts/generate-game-sounds.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../assets/sounds");
fs.mkdirSync(outDir, { recursive: true });

const SAMPLE_RATE = 22050;

function writeWav(filename, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(outDir, filename), buffer);
}

function envAttackRelease(n, attack, release) {
  return (i) => {
    const a = Math.min(1, i / attack);
    const r = Math.min(1, (n - 1 - i) / release);
    return Math.min(a, r);
  };
}

function sineTone(freq, durationSec, amplitude = 0.28) {
  const n = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Array(n);
  const env = envAttackRelease(n, 80, 400);
  for (let i = 0; i < n; i += 1) {
    samples[i] = amplitude * env(i) * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return samples;
}

function noiseBurst(durationSec, amplitude = 0.12) {
  const n = Math.floor(durationSec * SAMPLE_RATE);
  const samples = new Array(n);
  const env = envAttackRelease(n, 20, 120);
  let seed = 1234567;
  for (let i = 0; i < n; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    samples[i] = amplitude * env(i) * ((seed / 0x7fffffff) * 2 - 1);
  }
  return samples;
}

function concat(...parts) {
  return parts.flat();
}

function arpeggio(freqs, noteLenSec, amplitude = 0.22) {
  return concat(...freqs.map((f) => sineTone(f, noteLenSec, amplitude)));
}

// UI
writeWav("tap.wav", sineTone(920, 0.04, 0.22));
writeWav("card.wav", sineTone(660, 0.055, 0.2));
writeWav("confirm.wav", concat(sineTone(520, 0.035), sineTone(780, 0.045)));

// Game flow
writeWav("turn.wav", concat(sineTone(440, 0.06), sineTone(554, 0.08)));
writeWav("ask_hit.wav", arpeggio([523, 659, 784], 0.05));
writeWav("ask_miss.wav", concat(sineTone(300, 0.08, 0.26), sineTone(220, 0.12, 0.2)));
writeWav("declare_win.wav", arpeggio([392, 494, 587, 698], 0.045));
writeWav("declare_lose.wav", concat(sineTone(180, 0.14, 0.32), sineTone(140, 0.18, 0.28)));
writeWav("victory.wav", arpeggio([523, 659, 784, 988], 0.06));
writeWav("defeat.wav", concat(sineTone(196, 0.2, 0.3), sineTone(147, 0.25, 0.26)));
writeWav("deal.wav", noiseBurst(0.09, 0.1));
writeWav("error.wav", concat(sineTone(150, 0.06, 0.35), sineTone(120, 0.1, 0.3)));

console.log("Wrote WAVs to", outDir);
