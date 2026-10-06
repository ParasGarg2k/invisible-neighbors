# Architecture

## Project layout

```text
invisible-neighbors/
  docs/                  Technical notes and model licensing
  public/                Local photograph and asset attribution
  src/
    App.jsx              Shared state, app shell, routes, capture and stop detail
    pages/
      NotebookPage.jsx   Listening stop index and first-stop empty state
      PassportPage.jsx   Session discoveries and export view
    audio.js             Clip preparation, waveform peaks, match summaries
    audio.test.js        Audio helper tests
    inference.worker.js  Background model inference
    main.jsx             React entry point
    media.js             Local audio and video soundtrack decoding
    model.js             Runtime model download and TensorFlow.js loading
    notebook.js          IndexedDB persistence and passport export
    notebook.test.js     Notebook helper tests
    styles.css           Responsive interface styles
  tests/                 Playwright browser checks
  index.html             Browser entry document
  playwright.config.js   Browser check configuration
  vite.config.js         Development and build configuration
```

Generated directories such as `node_modules/`, `dist/`, and `test-results/` are local artifacts, not source files.

## Navigation

React Router's `BrowserRouter` provides the notebook (`/`), stop detail (`/stops/:id`), and passport (`/passport`) routes. The stop ID in the URL determines the selected recording. Missing stops and unknown URLs have recovery links to the notebook.

Shared notebook state, microphone capture, and the inference worker remain mounted in `App.jsx` during navigation. New imports open their stop detail page. IndexedDB remains the persistence layer; navigation does not upload recordings or trigger model downloads.

Production hosts must rewrite application routes to `index.html` so direct links and refreshes work. Vite handles this during development. A stop URL is local to the browser's stored notebook, not a public media-sharing link.

## Media and inference flow

1. The user imports audio/video or records with the microphone.
2. Mediabunny reads the audio track locally. An `OfflineAudioContext` renders mono samples at 48 kHz.
3. The notebook retains the original media, notes, and waveform in IndexedDB.
4. When the user requests analysis, the inference worker loads BirdNET. The browser fetches the official archive only when needed and caches it when storage permits.
5. The worker analyzes 3-second clips and returns timestamped predictions.
6. The UI groups possible species by maximum segment score. Changing the score threshold does not rerun inference.
7. Passport export creates a ZIP containing original recordings, an HTML report, and a JSON report locally.

Video analysis uses sound only; it does not identify visible objects or wildlife. No inference server, API key, account system, or media upload endpoint is used.

## Analysis boundaries

- Maximum 120 MB per file and 12 notebook stops.
- Inference covers the first 60 seconds; original media remains intact for playback and export.
- Microphone recording stops automatically after 60 seconds.
- BirdNET processes 3-second mono clips at 48 kHz. Short trailing clips are zero-padded, but evidence end timestamps retain their actual length.
- Silent clips are skipped. The top five predictions per clip are retained.
- Species are aggregated by their maximum segment score, not by counts of birds. No geographic prior is applied.
- Scores are not calibrated probabilities. Wind, traffic, overlapping calls, and rare species can produce false matches.
- Cancellation terminates the worker without removing previously completed results. A subsequent analysis reloads the model, using the cache when available.

## Storage and browser support

Notebook data belongs to the current browser origin. Storage can be cleared or evicted; export important sessions. If persistence fails, the current tab remains usable and shows a warning.

HTTPS or localhost is required for microphone recording, WebCodecs, and browser model caching. Chrome and Edge are recommended; codec support differs in Safari and Firefox. Cached model weights do not make the entire app an offline PWA.

## Existing checks

Audio and notebook unit tests live beside their modules. Playwright checks live in `tests/` and cover media decoding, error states, persistence, export, deferred model loading, worker inference, and responsive layouts. The model check uses the official sample recording, not a participant's outdoor observation.

Commands are listed in [CONTRIBUTING.md](../CONTRIBUTING.md).
