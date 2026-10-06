---
title: 'Invisible Neighbors: An AI Field Notebook for the Sounds Around Us'
published: false
tags: devchallenge, hf26challenge, ai, opensource
---

_This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)_

## What I Built

A familiar walk can become background noise. Invisible Neighbors starts with a different question: **who might be sharing this neighborhood, even when we cannot see them?**

I built a sound field notebook for curious walkers and beginner birders. The idea is simple: go outside, pause somewhere, collect a short recording, and return to it with fresh ears. BirdNET suggests possible birds, and each suggestion links back to the moment in the recording that produced it.

There is no chatbot to keep talking to and no feed to keep scrolling. The recording happens outdoors; the closer examination can happen afterward.

The application has three pages:

- **Notebook:** record with the microphone or import audio and video from a walk.
- **Listening stop:** play the original media, analyze its audio, and add a place and field notes.
- **Sound passport:** collect possible neighbors across stops and export a report with the original recordings.

A video recorded on a phone can be useful too: the app analyzes its soundtrack, while the original video remains available for playback. It does not identify animals visually.

The important word is **possible**. These are acoustic matches, not confirmed sightings. The app shows model scores and timestamped evidence so the user can listen and make their own judgment.

## Demo

**Demo video:** [Watch or download the browser walkthrough](https://github.com/ParasGarg2k/invisible-neighbors/blob/main/demo/demo.mp4) (also available at [`demo/demo.mp4`](./demo/demo.mp4)).

This screen recording demonstrates the application in a browser. It is a product walkthrough, not an outdoor field trial or evidence of confirmed bird identifications. The application can be run locally using the setup instructions in the repository README.

The walkthrough is intended to show:

1. Importing a short outdoor recording or a video with an audio track.
2. Opening its listening-stop page and requesting analysis.
3. BirdNET downloading at runtime, followed by local inference.
4. Playing timestamped evidence and adjusting the minimum score.
5. Adding field notes and exporting a sound passport.

The application runs locally at `http://127.0.0.1:5175/` during development. That address is not a public demo link.

## Code

**Repository:** https://github.com/ParasGarg2k/invisible-neighbors

The application code is MIT licensed. Model weights are not included in the repository or bundled into the application; they retain their separate upstream license.

## How I Built It

The AI core is [BirdNET v2.4](https://doi.org/10.5281/zenodo.15050749), developed by the Cornell Lab of Ornithology and Chemnitz University of Technology. Its TensorFlow.js release makes browser inference possible without an inference server.

The interface uses React and Vite, with React Router connecting the three pages. Notebook data stays shared during navigation and is saved locally in IndexedDB.

When someone requests analysis, the browser fetches the official model archive from Zenodo. TensorFlow.js runs inference in a worker, keeping the work separate from the interface. There are no API keys and no media-upload endpoint.

Mediabunny reads the recording's audio locally. The app renders mono audio at 48 kHz, splits it into three-second clips, and analyzes the first 60 seconds. Short trailing clips are padded, while their evidence timestamps preserve the actual recording length.

The app retains the top five predictions per clip and groups species using their highest segment score. Changing the score threshold filters the saved results rather than rerunning the model. It does not estimate how many birds were present or claim to measure ecosystem health.

Export creates a ZIP containing original recordings, a readable HTML report, and structured JSON. That makes the passport something the user can take away, rather than a result trapped inside an account.

One practical boundary: cached weights are not the same as a fully offline application. The first model download requires internet, browser storage can be evicted, and the app is not an offline PWA. Google Fonts also creates a network request; local inference does not mean zero network activity.

## Why Does Open Innovation Matter?

For this project, access to the model changes the architecture.

I can bring the model to the recording instead of sending the recording to a service. A closed hosted API could analyze sound, but it would introduce an external processing dependency; here, inference takes place on the user's device.

That matters for recordings made near homes or conversations. The app does not need precise GPS, an account, or a server holding someone's media. Users decide whether to share anything by exporting it.

The model release also makes the processing inspectable. Its input format, preprocessing, scores, and evidence windows are part of the implementation rather than hidden behind an API response. Developers can examine the pipeline and improve it within the applicable license terms.

There are no paid inference API calls. Local processing still uses bandwidth for the initial download and the device's own compute resources.

**The licensing distinction matters:** BirdNET-Analyzer's code is MIT licensed, but its repository describes the models as CC BY-NC-SA 4.0. The Zenodo record has differing license metadata. This is a freely available model with noncommercial restrictions, not an unrestricted model license. My application does not relicense or redistribute the weights. Contest-use permission and the metadata discrepancy remain matters to clarify with the maintainers and organizers.

Open innovation made this local, evidence-linked workflow possible. It did not remove the responsibility to respect licenses or explain the model's limitations.


## Prize Categories

- **Best Use of GitHub Copilot:** Copilot's agent mode in VS Code was used to implement and refine the application. Copilot assisted development; BirdNET is the model used by the application at runtime.

---