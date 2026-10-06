import { unzipSync, strFromU8 } from 'fflate';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops';
import { layers, initializers, loadLayersModel } from '@tensorflow/tfjs-layers';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';

export const MODEL_URL =
  'https://zenodo.org/api/records/15050749/files/BirdNET_v2.4_tfjs.zip/content';
export const MODEL_CACHE = 'invisible-neighbors-birdnet-v2.4';

export async function fetchArchive(onProgress = () => {}) {
  const cached = await globalThis.caches?.match(MODEL_URL).catch(() => undefined);
  if (cached) {
    onProgress({ stage: 'prepare' });
    return unzipSync(new Uint8Array(await cached.arrayBuffer()));
  }
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`BirdNET download failed (${response.status}). Please retry.`);
  const total = Number(response.headers.get('content-length')) || 75_000_000;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress({ stage: 'download', loaded, total });
  }
  const archive = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    archive.set(chunk, offset);
    offset += chunk.length;
  }
  if (globalThis.caches) {
    try {
      const cache = await caches.open(MODEL_CACHE);
      await cache.put(
        MODEL_URL,
        new Response(archive, { headers: { 'Content-Type': 'application/zip' } }),
      );
    } catch {}
  }
  return unzipSync(archive);
}

export function archiveText(files, suffix) {
  const name = Object.keys(files).find((path) => path === suffix || path.endsWith(`/${suffix}`));
  if (!name) throw new Error(`The official model archive is missing ${suffix}.`);
  return strFromU8(files[name]);
}

class BirdNETSpectrogram extends layers.Layer {
  constructor(config) {
    super(config);
    this.specShape = config.specShape;
    this.frameLength = config.frameLength;
    this.frameStep = config.frameStep;
    this.filterbank = tf.tensor2d(config.melFilterbank);
  }

  build(shape) {
    this.scaling = this.addWeight(
      'magnitude_scaling',
      [],
      'float32',
      initializers.constant({ value: 1.23 }),
    );
    super.build(shape);
  }

  computeOutputShape(shape) {
    return [shape[0], ...this.specShape, 1];
  }

  call(inputs) {
    return tf.tidy(() =>
      tf.stack(
        tf.unstack(inputs[0]).map((waveform) => {
          const shifted = waveform.sub(waveform.min());
          const normalized = shifted.div(shifted.max().add(1e-6)).sub(0.5).mul(2);
          const spectrum = tf.signal.stft(
            normalized,
            this.frameLength,
            this.frameStep,
            this.frameLength,
            tf.signal.hannWindow,
          );
          const power = tf.matMul(tf.cast(spectrum, 'float32'), this.filterbank).square();
          const exponent = tf.scalar(1).div(this.scaling.read().exp().add(1));
          return power.pow(exponent).reverse(-1).transpose().expandDims(-1);
        }),
      ),
    );
  }

  static get className() {
    return 'MelSpecLayerSimple';
  }
}

tf.serialization.registerClass(BirdNETSpectrogram);
let loading;

export async function loadBirdNET(onProgress = () => {}, suppliedArchive) {
  if (!loading) {
    loading = (async () => {
      const files = suppliedArchive || (await fetchArchive(onProgress));
      onProgress({ stage: 'prepare' });
      await tf.ready();
      const topology = JSON.parse(archiveText(files, 'model/model.json'));
      const weightSpecs = topology.weightsManifest.flatMap((group) => group.weights);
      const shards = topology.weightsManifest.flatMap((group) =>
        group.paths.map((path) => {
          const name = Object.keys(files).find(
            (entry) => entry === `model/${path}` || entry.endsWith(`/model/${path}`),
          );
          if (!name) throw new Error(`Missing model shard: ${path}`);
          return files[name];
        }),
      );
      const weights = new Uint8Array(shards.reduce((sum, shard) => sum + shard.length, 0));
      let offset = 0;
      for (const shard of shards) {
        weights.set(shard, offset);
        offset += shard.length;
      }
      const model = await loadLayersModel(
        tf.io.fromMemory({
          modelTopology: topology.modelTopology,
          weightSpecs,
          weightData: weights.buffer,
        }),
      );
      const labels = JSON.parse(archiveText(files, 'model/labels.json'));
      if (model.inputs[0].shape[1] !== 144000 || model.outputs[0].shape[1] !== labels.length) {
        model.dispose();
        throw new Error('Unexpected BirdNET input or label dimensions.');
      }
      onProgress({ stage: 'ready' });
      return { model, labels };
    })().catch((error) => {
      loading = undefined;
      throw error;
    });
  }
  return loading;
}

export async function predictClip(samples, onProgress = () => {}, suppliedArchive) {
  const { model, labels } = await loadBirdNET(onProgress, suppliedArchive);
  const input = tf.tensor2d(samples, [1, 144000]);
  let output;
  try {
    output = model.predict(input);
    const scores = await output.data();
    return Array.from(scores, (score, index) => ({ label: labels[index], score }))
      .sort((first, second) => second.score - first.score)
      .slice(0, 5);
  } finally {
    input.dispose();
    output?.dispose();
  }
}
