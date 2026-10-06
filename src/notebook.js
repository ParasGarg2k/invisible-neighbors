import { get, set } from 'idb-keyval';
import { zipSync, strToU8 } from 'fflate';
import { summarizeMatches } from './audio.js';

export const NOTEBOOK_KEY = 'invisible-neighbors-notebook-v1';
export const loadNotebook = async () => (await get(NOTEBOOK_KEY)) || [];
export const saveNotebook = (entries) => set(NOTEBOOK_KEY, entries);

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

export async function exportNotebook(entries, threshold) {
  const files = {};
  const report = {
    title: 'Invisible Neighbors - Sound Passport',
    exportedAt: new Date().toISOString(),
    model: 'BirdNET v2.4 (TensorFlow.js)',
    modelSource: 'https://doi.org/10.5281/zenodo.15050749',
    modelLicense: 'https://github.com/birdnet-team/BirdNET-Analyzer#license',
    caveat:
      'Tentative acoustic matches, not confirmed sightings. Scores are not calibrated probabilities. Video frames are not analyzed.',
    threshold,
    entries: [],
  };
  const sections = [];
  for (const [index, entry] of entries.entries()) {
    const filename = `recordings/${index + 1}-${entry.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    files[filename] = new Uint8Array(await entry.file.arrayBuffer());
    const matches = summarizeMatches(entry.segments || [], threshold);
    report.entries.push({
      id: entry.id,
      title: entry.title,
      place: entry.place,
      notes: entry.notes,
      createdAt: entry.createdAt,
      duration: entry.duration,
      analyzedDuration: entry.analyzedDuration,
      recording: filename,
      segments: entry.segments || [],
      matches,
    });
    sections.push(
      `<section><h2>${escapeHTML(entry.title)}</h2><p>${escapeHTML(entry.place || 'Location not recorded')}</p><p>${escapeHTML(entry.notes)}</p><${entry.isVideo ? 'video' : 'audio'} controls src="${escapeHTML(filename)}"></${entry.isVideo ? 'video' : 'audio'}><p>${entry.segments ? `${entry.analyzedDuration.toFixed(1)} seconds analyzed` : 'Not analyzed'}</p><ul>${matches.map((match) => `<li>${escapeHTML(match.name)}: score ${match.score.toFixed(3)}; at ${match.moments.map((moment) => `${moment.start.toFixed(1)}-${moment.end.toFixed(1)}s`).join(', ')}</li>`).join('')}</ul></section>`,
    );
  }
  files['report.json'] = strToU8(JSON.stringify(report, null, 2));
  files['index.html'] = strToU8(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invisible Neighbors - Sound Passport</title><style>body{font:17px Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;color:#203b32;background:#fff}section{border-top:1px solid #ccc;padding:20px 0}video,audio{max-width:100%}p{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Invisible Neighbors</h1><p>Sound Passport | ${escapeHTML(report.exportedAt.slice(0, 10))}</p><p>${escapeHTML(report.caveat)}</p>${sections.join('')}<footer><p>BirdNET by the Cornell Lab of Ornithology and Chemnitz University of Technology. <a href="${report.modelSource}">Model source</a> | <a href="${report.modelLicense}">Model license information</a>. Recordings remain their owner's work.</p></footer></html>`,
  );
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}
