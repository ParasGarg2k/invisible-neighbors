# Contributing

Invisible Neighbors is a browser-only field notebook. Changes should keep recordings on the user's device and model downloads in the browser.

## Get started

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev -- --port 5175
```

## Code style

Use descriptive names and small, focused functions. Keep UI code in `src/App.jsx`, media decoding in `src/media.js`, audio helpers in `src/audio.js`, and model loading in `src/model.js`. Keep inference in its worker so it does not block the interface.

Prettier is the shared formatter. It uses two-space indentation, single quotes in JavaScript, semicolons, and a 100-character target line width. Editor defaults are defined in `.editorconfig`.

```sh
npm run format
npm run format:check
```

Avoid unrelated refactors. Update the documentation when changing supported formats, limits, storage behavior, or model sources.

## Available checks

Run checks appropriate to your change when requested. Browser model checks require internet access for an uncached runtime download.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

## Before sharing a change

- Explain what changed and why.
- Describe checks performed, or clearly state that they were not run.
- Keep generated builds, local environment files, recordings, and model weights out of version control.
- Attribute any new third-party assets and document their licenses.
- Do not describe model scores as confirmed sightings or calibrated probabilities.

See [architecture](docs/architecture.md) and [model licensing](docs/model-licensing.md) for the project boundaries.
