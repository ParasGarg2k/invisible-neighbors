export const SAMPLE_RATE = 48000;
export const CLIP_SAMPLES = SAMPLE_RATE * 3;
export const MAX_SECONDS = 60;
export const MAX_FILE_BYTES = 120 * 1024 * 1024;

export function mixToMono(channels) {
  if (!channels.length) throw new Error('No audio channels found.');
  const mono = new Float32Array(channels[0].length);
  for (const channel of channels) {
    for (let index = 0; index < mono.length; index++)
      mono[index] += channel[index] / channels.length;
  }
  return mono;
}

export function audioChunks(samples) {
  const chunks = [];
  for (let offset = 0; offset < samples.length; offset += CLIP_SAMPLES) {
    const clip = new Float32Array(CLIP_SAMPLES);
    const available = samples.subarray(offset, offset + CLIP_SAMPLES);
    clip.set(available);
    const energy = available.reduce((sum, value) => sum + value * value, 0);
    chunks.push({
      samples: clip,
      start: offset / SAMPLE_RATE,
      end: (offset + available.length) / SAMPLE_RATE,
      silent: energy / available.length < 1e-10,
    });
  }
  return chunks;
}

export function summarizeMatches(segments, threshold = 0.25) {
  const matches = new Map();
  for (const segment of segments) {
    for (const prediction of segment.predictions) {
      if (!Number.isFinite(prediction.score) || prediction.score < threshold) continue;
      const existing = matches.get(prediction.label);
      const separator = prediction.label.indexOf('_');
      const match = existing || {
        label: prediction.label,
        scientific: prediction.label.slice(0, separator),
        name: prediction.label.slice(separator + 1),
        score: 0,
        moments: [],
      };
      match.score = Math.max(match.score, prediction.score);
      match.moments.push({ start: segment.start, end: segment.end, score: prediction.score });
      matches.set(prediction.label, match);
    }
  }
  return [...matches.values()].sort((first, second) => second.score - first.score);
}

export function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function waveformPeaks(samples, count = 180) {
  const peaks = [];
  const stride = Math.max(1, Math.ceil(samples.length / count));
  for (let offset = 0; offset < samples.length; offset += stride) {
    let peak = 0;
    for (let index = offset; index < Math.min(offset + stride, samples.length); index++)
      peak = Math.max(peak, Math.abs(samples[index]));
    peaks.push(peak);
  }
  return peaks;
}
