import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mixToMono,
  audioChunks,
  summarizeMatches,
  CLIP_SAMPLES,
  formatTime,
  waveformPeaks,
} from './audio.js';

test('mixes stereo without changing amplitude or retaining only one channel', () => {
  assert.deepEqual(
    [...mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])])],
    [0.5, 0.5],
  );
});

test('pads the final three-second chunk but keeps its actual evidence timestamp', () => {
  const chunks = audioChunks(new Float32Array(CLIP_SAMPLES + 48000).fill(0.2));
  assert.equal(chunks.length, 2);
  assert.equal(chunks[1].samples.length, CLIP_SAMPLES);
  assert.equal(chunks[1].start, 3);
  assert.equal(chunks[1].end, 4);
  assert.equal(chunks[1].samples[48000], 0);
  assert.equal(chunks[0].silent, false);
  assert.equal(audioChunks(new Float32Array(48000))[0].silent, true);
});

test('aggregates maximum scores and preserves each recording moment', () => {
  const segments = [
    { start: 0, end: 3, predictions: [{ label: 'Acanthis cabaret_Lesser Redpoll', score: 0.9 }] },
    {
      start: 3,
      end: 6,
      predictions: [
        { label: 'Acanthis cabaret_Lesser Redpoll', score: 0.6 },
        { label: 'Test_Low match', score: 0.1 },
      ],
    },
  ];
  const results = summarizeMatches(segments);
  assert.equal(results.length, 1);
  assert.equal(results[0].score, 0.9);
  assert.equal(results[0].moments.length, 2);
  assert.equal(results[0].name, 'Lesser Redpoll');
  assert.equal(summarizeMatches(segments, 0.95).length, 0);
});

test('formats time and generates waveform only from actual samples', () => {
  assert.equal(formatTime(65.5), '1:05');
  assert.deepEqual(
    waveformPeaks(new Float32Array([0, -0.8, 0.4, 0]), 2).map((value) => Math.round(value * 10)),
    [8, 4],
  );
});
