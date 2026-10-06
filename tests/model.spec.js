import { test, expect } from '@playwright/test';

test('official BirdNET archive loads and predicts entirely in the browser', async ({ page }) => {
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(message.text());
  });
  await page.goto('/');
  await page.evaluate(async () => {
    await import('/src/model.js');
  });
  await page.waitForLoadState('networkidle');
  const result = await page.evaluate(async () => {
    const mod = await import('/src/model.js');
    const files = await mod.fetchArchive();
    window.__testArchive = files;
    const sample = Object.keys(files).find((path) => path.endsWith('sample.wav'));
    const context = new AudioContext({ sampleRate: 48000 });
    const audio = await context.decodeAudioData(files[sample].slice().buffer);
    await context.close();
    const samples = new Float32Array(144000);
    samples.set(audio.getChannelData(0).subarray(0, 144000));
    return await mod.predictClip(samples, () => {}, files);
  });
  console.log('Official sample predictions:', result);
  expect(result).toHaveLength(5);
  expect(result[0].score).toBeGreaterThan(0.1);
  expect(
    result.every((entry) => Number.isFinite(entry.score) && entry.score >= 0 && entry.score <= 1),
  ).toBe(true);
  const networkWrites = [];
  page.on('request', (request) => {
    if (['POST', 'PUT'].includes(request.method())) networkWrites.push(request.url());
  });
  await page.evaluate(async () => {
    const files = window.__testArchive;
    const sample = Object.keys(files).find((path) => path.endsWith('sample.wav'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([files[sample]], 'outdoor-sample.wav', { type: 'audio/wav' }));
    const input = document.querySelector('input[type=file]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByLabel('Stop title')).toBeVisible();
  await page.getByRole('button', { name: 'Find possible neighbors' }).click();
  await expect(page.getByText('Lesser Redpoll', { exact: true })).toBeVisible({ timeout: 120000 });
  const videoBytes = await page.evaluate(async () => {
    const files = window.__testArchive;
    const sample = Object.keys(files).find((path) => path.endsWith('sample.wav'));
    const context = new AudioContext({ sampleRate: 48000 });
    await context.resume();
    const audio = await context.decodeAudioData(files[sample].slice().buffer);
    const source = context.createBufferSource();
    source.buffer = audio;
    const destination = context.createMediaStreamDestination();
    source.connect(destination);
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = '#447b64';
    drawing.fillRect(0, 0, 160, 90);
    const stream = canvas.captureStream(10);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks = [];
    const blob = await new Promise((resolve) => {
      recorder.ondataavailable = ({ data }) => chunks.push(data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
      recorder.start();
      source.start();
      source.onended = () => recorder.stop();
    });
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page
    .getByLabel('Upload audio or video recording')
    .setInputFiles({
      name: 'bird-soundtrack.webm',
      mimeType: 'video/webm',
      buffer: Buffer.from(videoBytes),
    });
  await expect(page.getByLabel('Original video recording')).toBeVisible();
  await page.getByRole('button', { name: 'Find possible neighbors' }).click();
  await expect(page.getByText('Lesser Redpoll', { exact: true })).toBeVisible({ timeout: 120000 });
  await page
    .getByRole('button', { name: /Play Lesser Redpoll evidence/ })
    .first()
    .click();
  await expect(page.getByLabel('Original video recording')).toHaveJSProperty('paused', false);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/matches-${viewport.width}.png`, fullPage: true });
  }
  await page.getByLabel('Approximate location').fill('Neighborhood park');
  await page.getByRole('tab', { name: 'Field notes' }).click();
  await page
    .getByLabel('Your observations')
    .fill('Actual sample recording, not a confirmed sighting.');
  await page.reload();
  await expect(page.getByLabel('Approximate location')).toHaveValue('Neighborhood park');
  await page.getByRole('tab', { name: 'Field notes' }).click();
  await expect(page.getByLabel('Your observations')).toHaveValue(
    'Actual sample recording, not a confirmed sighting.',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export passport' }).click();
  expect((await download).suggestedFilename()).toMatch(/invisible-neighbors.*\.zip/);
  expect(networkWrites).toEqual([]);
});
