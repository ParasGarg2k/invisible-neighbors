import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { exportNotebook } from './notebook.js';

test('passport includes original recordings, scores, timestamps, and escaped field notes', async () => {
  const entries = [
    {
      id: 'test-stop',
      title: '<script>bad()</script>',
      place: 'Park & street',
      notes: '<img src=x onerror=bad()>',
      filename: '../recording.wav',
      file: new Blob(['original-recording']),
      createdAt: '2026-10-06',
      duration: 3,
      analyzedDuration: 3,
      isVideo: false,
      segments: [{ start: 0, end: 3, predictions: [{ label: 'Test bird_Test name', score: 0.8 }] }],
    },
  ];
  const files = unzipSync(
    new Uint8Array(await (await exportNotebook(entries, 0.25)).arrayBuffer()),
  );
  const report = JSON.parse(strFromU8(files['report.json']));
  assert.equal(report.entries[0].matches[0].score, 0.8);
  assert.equal(report.entries[0].segments[0].end, 3);
  assert.equal(strFromU8(files[report.entries[0].recording]), 'original-recording');
  assert.ok(!report.entries[0].recording.includes('/../'));
  const html = strFromU8(files['index.html']);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('not confirmed sightings'));
});
