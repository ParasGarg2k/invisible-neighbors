import { loadBirdNET, predictClip } from './model.js';
import { audioChunks } from './audio.js';

self.onmessage = async ({ data }) => {
  try {
    await loadBirdNET((progress) => self.postMessage({ type: 'progress', ...progress }));
    const chunks = audioChunks(data.samples);
    const segments = [];
    for (const [index, chunk] of chunks.entries()) {
      const predictions = chunk.silent ? [] : await predictClip(chunk.samples);
      segments.push({ start: chunk.start, end: chunk.end, predictions });
      self.postMessage({
        type: 'progress',
        stage: 'analyze',
        completed: index + 1,
        total: chunks.length,
      });
    }
    self.postMessage({ type: 'result', segments });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message || 'BirdNET analysis failed. Please retry.',
    });
  }
};
