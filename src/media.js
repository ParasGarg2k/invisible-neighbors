import { Input, ALL_FORMATS, BlobSource, AudioBufferSink } from 'mediabunny';
import { SAMPLE_RATE, MAX_SECONDS, MAX_FILE_BYTES, mixToMono } from './audio.js';

export async function decodeMedia(file) {
  if (!file.size) throw new Error('This file is empty.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Choose a recording smaller than 120 MB.');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    if (!(await input.canRead()))
      throw new Error('Unsupported file. Try WAV, MP3, MP4, MOV, or WebM.');
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error('This video has no audio track. BirdNET needs recorded sound.');
    if (!(await track.canDecode()))
      throw new Error(
        'Your browser cannot decode this audio codec. Try Chrome or convert the recording to WAV or MP4/AAC.',
      );
    const duration = await track.computeDuration();
    const analyzedDuration = Math.min(duration, MAX_SECONDS);
    if (!Number.isFinite(analyzedDuration) || analyzedDuration <= 0)
      throw new Error('No playable audio found.');
    const renderer = new OfflineAudioContext(
      1,
      Math.ceil(analyzedDuration * SAMPLE_RATE),
      SAMPLE_RATE,
    );
    const sink = new AudioBufferSink(track);
    for await (const { buffer, timestamp } of sink.buffers(0, analyzedDuration)) {
      const mono = renderer.createBuffer(1, buffer.length, buffer.sampleRate);
      mono.copyToChannel(
        mixToMono(
          Array.from({ length: buffer.numberOfChannels }, (_, index) =>
            buffer.getChannelData(index),
          ),
        ),
        0,
      );
      const source = renderer.createBufferSource();
      source.buffer = mono;
      source.connect(renderer.destination);
      source.start(Math.max(timestamp, 0), Math.max(-timestamp, 0));
    }
    const rendered = await renderer.startRendering();
    return {
      samples: rendered.getChannelData(0).slice(),
      duration,
      analyzedDuration,
      isVideo: Boolean(await input.getPrimaryVideoTrack()),
    };
  } finally {
    input.dispose();
  }
}
