# Invisible Neighbors

A private sound field notebook for the **Touch Grass** challenge. Collect listening stops outdoors, then use BirdNET to suggest which birds might be audible. Audio files, uploaded video soundtracks, and microphone recordings are processed locally in the browser.

## Run

Node.js 20.19+ or 22.12+ recommended.

```sh
npm install
npm run dev -- --port 5175
```

Open http://127.0.0.1:5175. HTTPS or localhost is required for microphone recording, WebCodecs, and browser model caching. Chrome/Edge are recommended; codecs available in Safari/Firefox differ. No API keys or inference server are required.

## Workflow

- **Notebook** (`/`): record, import, and browse listening stops.
- **Listening stop** (`/stops/:id`): play a recording, run analysis, and edit field notes.
- **Sound passport** (`/passport`): review possible neighbors across stops and export the session.

Browser back/forward navigation is supported. Stop URLs refer to recordings stored in this browser; sharing a URL does not share the media. Export the passport to share recordings and observations.

1. Record a listening stop or import an audio/video file.
2. Add an approximate place and your own field notes. No GPS permission is requested.
3. Select **Find possible neighbors**. Only then does the browser fetch the official BirdNET v2.4 TensorFlow.js archive (~75 MB).
4. Listen back to timestamped evidence. Change the minimum model score without rerunning inference.
5. Export a ZIP sound passport containing original recordings, a readable HTML report, and a structured JSON report.

Video analysis uses the audio track only. It does **not** identify visible animals, litter, plants, or objects. The original video remains playable beside its analysis.

## Privacy And Limits

- Media never goes to an inference service; decoding and inference run on-device. The application contains no upload endpoint, analytics, or account system.
- First use contacts Zenodo to fetch weights. Fonts currently load from Google Fonts. The field photograph is served locally.
- Model weights are not bundled, checked in, or fetched by a build/install script. The browser caches the official archive when storage permits. Cached weights do not make the whole application an offline PWA.
- Notebook data, including original media, is stored in IndexedDB on this origin. Browser storage can be cleared or evicted; export important sessions. If storage fails, a warning is shown and the current tab remains usable.
- Maximum 120 MB per file and 12 stops. Analysis covers the first 60 seconds. Longer files remain intact in the player and export. Recording stops automatically at 60 seconds.
- BirdNET processes 3-second mono clips at 48 kHz. Short trailing clips are zero-padded; evidence end timestamps retain their real length. Silent clips are skipped.
- Top five scores per clip are retained. Species are aggregated using their maximum segment score, not a count of individual birds. No geographic prior is applied.
- Scores are not calibrated probabilities or confirmed sightings. Wind, traffic, rare species, and overlapping calls can produce false matches. Human review is essential; no biodiversity or ecosystem-health claims are made.
- Cancelling analysis terminates its worker; previously completed notebook results remain untouched. The model will load again on a subsequent run, using the cache where available.

## Project guide

- [Architecture and source layout](docs/architecture.md): where the code lives and how media reaches the model.
- [Contributing](CONTRIBUTING.md): local setup, code style, formatting commands, and available checks.
- [Model provenance and licensing](docs/model-licensing.md): official downloads, attribution, and separate model terms.
- [Asset credits](public/ASSETS.md): photograph source and attribution.

## License

Application code is [MIT licensed](LICENSE). BirdNET models, user recordings, and the photograph retain their own licenses. Model use is subject to noncommercial terms; open-source application code does not override them. See the [model licensing notes](docs/model-licensing.md) before redistributing assets or changing how the model is used.

## Challenge status

This is a new local project. Publishing a fresh remote repository, recording an actual outdoor trial, and writing the DEV submission remain separate release steps. Do not present the official test recording as your own outdoor observation.
