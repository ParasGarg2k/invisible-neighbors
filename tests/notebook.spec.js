import { test, expect } from '@playwright/test';

test('desktop and mobile render without overflow or model downloads before analysis', async ({
  page,
}) => {
  const modelRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('zenodo.org')) modelRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your listening session' })).toBeVisible();
  await expect(page.getByAltText('A small bird perched outdoors')).toBeVisible();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/notebook-${viewport.width}.png`, fullPage: true });
  }
  expect(modelRequests).toEqual([]);
});

test('uploaded video is decoded locally, and silent video has no fabricated matches', async ({
  page,
}) => {
  await page.goto('/');
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = '#447b64';
    drawing.fillRect(0, 0, 160, 90);
    const context = new AudioContext({ sampleRate: 44100 });
    await context.resume();
    const destination = context.createMediaStreamDestination();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    const stream = canvas.captureStream(10);
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks = [];
    const blob = await new Promise((resolve) => {
      recorder.ondataavailable = ({ data }) => chunks.push(data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
      recorder.start();
      setTimeout(() => recorder.stop(), 1200);
    });
    oscillator.stop();
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page
    .getByLabel('Upload audio or video recording')
    .setInputFiles({ name: 'park-video.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) });
  await expect(page.getByLabel('Original video recording')).toBeVisible();
  const data = await page.evaluate(async () => {
    const { loadNotebook } = await import('/src/notebook.js');
    const { decodeMedia } = await import('/src/media.js');
    const entries = await loadNotebook();
    const decoded = await decodeMedia(entries[0].file);
    return {
      isVideo: decoded.isVideo,
      duration: decoded.duration,
      samples: decoded.samples.length,
      maximum: decoded.samples.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0),
    };
  });
  expect(data.isVideo).toBe(true);
  expect(data.duration).toBeGreaterThan(0.5);
  expect(data.samples).toBeGreaterThan(24000);
  expect(data.maximum).toBeLessThan(0.00001);
  await page.getByRole('tab', { name: 'Field notes' }).click();
  await page.getByLabel('Your observations').fill('A local video soundtrack.');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/video-mobile.png', fullPage: true });
});

test('bad files show useful errors without downloading a model', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Upload audio or video recording')
    .setInputFiles({
      name: 'broken.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('not a video'),
    });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeEnabled();
});

test('microphone capture stops, imports a recording, and releases its track', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      const source = context.createOscillator();
      source.connect(destination);
      source.start();
      window.__testMicrophone = destination.stream;
      return destination.stream;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recording 0:01' })).toBeVisible({
    timeout: 5000,
  });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByLabel('Original audio recording')).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__testMicrophone.getTracks().every((track) => track.readyState === 'ended'),
    ),
  ).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
