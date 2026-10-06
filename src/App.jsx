import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useMatch, useNavigate } from 'react-router-dom';
import NotebookPage from './pages/NotebookPage.jsx';
import PassportPage from './pages/PassportPage.jsx';
import {
  Bird,
  AudioLines,
  Upload,
  Mic,
  Square,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  BookOpen,
  Stamp,
  MapPin,
  ShieldCheck,
  Download,
  Trash2,
  X,
  LoaderCircle,
  Play,
  Check,
  Headphones,
  Leaf,
  Volume2,
} from 'lucide-react';
import { decodeMedia } from './media.js';
import { formatTime, summarizeMatches, waveformPeaks } from './audio.js';
import { loadNotebook, saveNotebook, exportNotebook } from './notebook.js';
import './styles.css';

function Waveform({ peaks }) {
  const canvas = useRef(null);
  useEffect(() => {
    const context = canvas.current.getContext('2d');
    context.clearRect(0, 0, 900, 110);
    const maximum = Math.max(...peaks, 0.001);
    const width = 900 / Math.max(peaks.length, 1);
    peaks.forEach((peak, index) => {
      const height = Math.max(2, (peak / maximum) * 88);
      context.fillStyle = index % 9 === 0 ? '#ed936d' : '#3e7968';
      context.fillRect(index * width, (110 - height) / 2, Math.max(1, width - 2), height);
    });
  }, [peaks]);
  return (
    <canvas
      ref={canvas}
      width="900"
      height="110"
      role="img"
      aria-label="Waveform of the recorded audio"
    />
  );
}

function progressText(progress) {
  if (!progress) return 'Preparing recording';
  if (progress.stage === 'download')
    return `Downloading BirdNET: ${(progress.loaded / 1e6).toFixed(1)} / ${(progress.total / 1e6).toFixed(1)} MB`;
  if (progress.stage === 'analyze')
    return `Listening to segment ${progress.completed} of ${progress.total}`;
  if (progress.stage === 'ready') return 'BirdNET ready. Listening locally';
  return 'Preparing BirdNET in your browser';
}

export default function App() {
  const navigate = useNavigate();
  const stopRoute = useMatch('/stops/:id');
  const notebookRoute = useMatch('/');
  const passportRoute = useMatch('/passport');
  const selected = stopRoute?.params.id;
  const [entries, setEntries] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [threshold, setThreshold] = useState(0.25);
  const [tab, setTab] = useState('matches');
  const [mediaURL, setMediaURL] = useState('');
  const [exporting, setExporting] = useState(false);
  const [storageReady, setStorageReady] = useState(true);
  const fileInput = useRef(null);
  const player = useRef(null);
  const recorder = useRef(null);
  const stream = useRef(null);
  const worker = useRef(null);
  const timer = useRef(null);
  const recordingStarted = useRef(0);
  const current = entries.find((entry) => entry.id === selected);
  const matches = summarizeMatches(current?.segments || [], threshold);
  const allMatches = new Set(
    entries.flatMap((entry) =>
      summarizeMatches(entry.segments || [], threshold).map((match) => match.label),
    ),
  );

  useEffect(() => {
    let mounted = true;
    loadNotebook()
      .then((saved) => {
        if (!mounted) return;
        setEntries(saved);
      })
      .catch(() => {
        if (mounted) {
          setStorageReady(false);
          setError(
            'Local storage is unavailable. Recordings will stay in this tab only; export before closing.',
          );
        }
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setTab('matches');
  }, [selected]);

  useEffect(() => {
    if (!hydrated || !storageReady) return;
    saveNotebook(entries).catch(() => {
      setStorageReady(false);
      setError(
        'The notebook could not be saved locally. Export your recordings before closing this tab.',
      );
    });
  }, [entries, hydrated, storageReady]);

  useEffect(() => {
    if (!current) {
      setMediaURL('');
      return;
    }
    const url = URL.createObjectURL(current.file);
    setMediaURL(url);
    return () => URL.revokeObjectURL(url);
  }, [current?.file]);

  useEffect(
    () => () => {
      clearInterval(timer.current);
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      worker.current?.terminate();
    },
    [],
  );

  function updateEntry(id, patch) {
    setEntries((previous) =>
      previous.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  async function addFile(file) {
    if (!file || busy || recording) return;
    if (entries.length >= 12) {
      setError('This notebook holds 12 stops. Export it, then remove a stop to add another.');
      return;
    }
    setBusy(true);
    setError('');
    setProgress(null);
    try {
      const decoded = await decodeMedia(file);
      const id = crypto.randomUUID();
      const entry = {
        id,
        file,
        filename: file.name,
        title: `Listening stop ${String(entries.length + 1).padStart(2, '0')}`,
        place: '',
        notes: '',
        createdAt: new Date().toISOString(),
        duration: decoded.duration,
        analyzedDuration: decoded.analyzedDuration,
        isVideo: decoded.isVideo,
        peaks: waveformPeaks(decoded.samples),
      };
      setEntries((previous) => [...previous, entry]);
      navigate(`/stops/${id}`);
      setTab('matches');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (entries.length >= 12) {
      setError('Export and remove a stop before recording another.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder)
        throw new Error('Microphone recording requires a supported browser on HTTPS or localhost.');
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      recorder.current = new MediaRecorder(stream.current, mimeType ? { mimeType } : {});
      const chunks = [];
      recorder.current.ondataavailable = ({ data }) => {
        if (data.size) chunks.push(data);
      };
      recorder.current.onstop = () => {
        clearInterval(timer.current);
        stream.current?.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const type = recorder.current.mimeType;
        const file = new File(
          chunks,
          `field-recording-${Date.now()}.${type.includes('mp4') ? 'm4a' : 'webm'}`,
          { type },
        );
        void addFile(file);
      };
      recorder.current.onerror = () => {
        stopRecording();
        setError('Microphone recording failed. Try importing a recording.');
      };
      recorder.current.start();
      recordingStarted.current = Date.now();
      setRecordSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - recordingStarted.current) / 1000);
        setRecordSeconds(seconds);
        if (seconds >= 60) stopRecording();
      }, 250);
    } catch (failure) {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError(
        failure.name === 'NotAllowedError'
          ? 'Microphone access was denied. You can still import audio or video.'
          : failure.message,
      );
    } finally {
      setBusy(false);
    }
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    clearInterval(timer.current);
  }

  async function analyze() {
    if (!current || busy) return;
    const entry = current;
    setBusy(true);
    setError('');
    setProgress(null);
    try {
      const { samples } = await decodeMedia(entry.file);
      if (!worker.current)
        worker.current = new Worker(new URL('./inference.worker.js', import.meta.url), {
          type: 'module',
        });
      worker.current.onmessage = ({ data }) => {
        if (data.type === 'progress') setProgress(data);
        if (data.type === 'result') {
          updateEntry(entry.id, { segments: data.segments });
          setProgress(null);
          setBusy(false);
        }
        if (data.type === 'error') {
          setError(data.message);
          setBusy(false);
          setProgress(null);
        }
      };
      worker.current.onerror = () => {
        setError('The analysis worker stopped unexpectedly. Please retry.');
        worker.current?.terminate();
        worker.current = null;
        setBusy(false);
        setProgress(null);
      };
      worker.current.postMessage({ samples }, [samples.buffer]);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
      setProgress(null);
    }
  }

  function cancelAnalysis() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setProgress(null);
  }

  async function exportPassport() {
    setExporting(true);
    setError('');
    try {
      const blob = await exportNotebook(entries, threshold);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `invisible-neighbors-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (failure) {
      setError(`Export failed: ${failure.message}`);
    } finally {
      setExporting(false);
    }
  }

  function playMoment(start) {
    if (!player.current) return;
    player.current.currentTime = start;
    player.current
      .play()
      .catch(() =>
        setError('This browser cannot play the original recording. Try another browser.'),
      );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Invisible Neighbors home">
          <Bird size={27} strokeWidth={1.6} />
          <span>
            invisible neighbors<span className="brand-sub">A SOUND FIELD NOTEBOOK</span>
          </span>
        </Link>
        <div className="top-actions">
          <span className="private">
            <ShieldCheck size={15} /> {storageReady ? 'On this device' : 'This tab only'}
          </span>
          <a
            href="https://github.com/birdnet-team/BirdNET-Analyzer"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            BirdNET <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="notebook-heading">
            <span className="eyebrow">YOUR FIELD NOTEBOOK</span>
            <Leaf size={17} />
          </div>
          <h1>
            Invisible
            <br /> Neighbors
          </h1>
          <nav className="page-navigation" aria-label="Main navigation">
            <NavLink to="/" end>
              <BookOpen size={17} /> Notebook
            </NavLink>
            <NavLink to="/passport">
              <Stamp size={17} /> Sound passport
            </NavLink>
          </nav>
          <div className="section-label">
            LISTENING STOPS <span>{entries.length}/12</span>
          </div>
          <nav aria-label="Listening stops" className="stop-list">
            {entries.map((entry, index) => (
              <button
                key={entry.id}
                className={`stop ${selected === entry.id ? 'selected' : ''}`}
                aria-current={selected === entry.id ? 'true' : undefined}
                disabled={busy || recording}
                onClick={() => {
                  navigate(`/stops/${entry.id}`);
                  setTab('matches');
                }}
              >
                <span className="stop-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="stop-info">
                  <strong>{entry.title}</strong>
                  <small>
                    {entry.place || (entry.isVideo ? 'Video recording' : 'Audio recording')}
                  </small>
                </span>
                {entry.segments ? <Check size={15} /> : <AudioLines size={15} />}
              </button>
            ))}
          </nav>
          {!entries.length && <p className="sidebar-empty">No stops yet.</p>}
          <button
            className="add-stop"
            onClick={() => fileInput.current.click()}
            disabled={!hydrated || busy || recording}
          >
            <Plus size={16} /> Add a listening stop
          </button>
          <div className="sidebar-bottom">
            <span className="eyebrow">A LITTLE LESS SCROLLING.</span>
            <p>A little more listening.</p>
            <span className="local-dot" /> Browser-only inference
          </div>
        </aside>
        <main>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link to="/">Notebook</Link>
            {!notebookRoute && (
              <>
                <span aria-hidden="true">/</span>
                <span aria-current="page">
                  {passportRoute
                    ? 'Sound passport'
                    : stopRoute
                      ? current?.title || 'Listening stop'
                      : 'Page not found'}
                </span>
              </>
            )}
          </nav>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                FIELD SESSION /{' '}
                {new Date()
                  .toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
                  .toUpperCase()}
              </span>
              <h2>
                {stopRoute
                  ? 'Listening stop'
                  : passportRoute
                    ? 'Your sound passport'
                    : 'Your listening session'}
              </h2>
            </div>
            {!passportRoute && (
              <button
                className="button secondary"
                disabled={!entries.length || busy || recording || exporting}
                onClick={exportPassport}
              >
                {exporting ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}{' '}
                Export passport
              </button>
            )}
          </div>
          <div className="session-overview" aria-label="Session summary">
            <div>
              <AudioLines size={18} />
              <span>
                <strong>{String(entries.length).padStart(2, '0')}</strong> listening stops
              </span>
            </div>
            <div>
              <Bird size={18} />
              <span>
                <strong>{String(allMatches.size).padStart(2, '0')}</strong> possible neighbors
              </span>
            </div>
            <div>
              <Headphones size={18} />
              <span>
                <strong>
                  {formatTime(entries.reduce((total, entry) => total + entry.duration, 0))}
                </strong>{' '}
                recorded
              </span>
            </div>
          </div>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="audio/*,video/*,.wav,.mp3,.flac,.ogg,.m4a,.mp4,.mov,.webm"
            aria-label="Upload audio or video recording"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void addFile(file);
            }}
          />
          {error && (
            <div className="error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                title="Dismiss error"
                onClick={() => setError('')}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {(notebookRoute || recording) && (
            <section
              className={`capture-strip ${recording ? 'recording' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void addFile(event.dataTransfer.files[0]);
              }}
            >
              <div className="capture-icon">
                {recording ? <Mic size={25} /> : <Headphones size={25} />}
              </div>
              <div className="capture-title">
                <h3>
                  {recording
                    ? `Recording ${formatTime(recordSeconds)}`
                    : 'Bring back a little of the outdoors.'}
                </h3>
                <p>
                  {recording
                    ? 'Microphone active'
                    : 'Audio or video · up to 120 MB · first 60 seconds'}
                </p>
              </div>
              <div className="capture-actions">
                <button
                  className="button secondary"
                  onClick={() => fileInput.current.click()}
                  disabled={!hydrated || busy || recording}
                >
                  <Upload size={17} /> Import
                </button>
                <button
                  className={`button ${recording ? 'danger' : 'primary'}`}
                  onClick={recording ? stopRecording : startRecording}
                  disabled={!hydrated || busy}
                >
                  {recording ? <Square size={15} /> : <Mic size={17} />}
                  {recording ? 'Stop' : 'Record'}
                </button>
              </div>
            </section>
          )}
          {busy && (
            <div className="progress" role="status" aria-live="polite">
              <LoaderCircle className="spin" size={19} />
              <span>{progressText(progress)}</span>
              {progress?.stage === 'download' && (
                <progress max={progress.total} value={progress.loaded} />
              )}
              {progress?.stage === 'analyze' && (
                <progress max={progress.total} value={progress.completed} />
              )}
              {progress && (
                <button
                  className="icon-button"
                  title="Cancel analysis"
                  aria-label="Cancel analysis"
                  onClick={cancelAnalysis}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}
          <Routes>
            <Route
              path="/"
              element={
                <NotebookPage
                  entries={entries}
                  threshold={threshold}
                  disabled={!hydrated || busy || recording}
                  onImport={() => fileInput.current.click()}
                  onOpen={(id) => navigate(`/stops/${id}`)}
                />
              }
            />
            <Route
              path="/passport"
              element={
                <PassportPage
                  entries={entries}
                  threshold={threshold}
                  onThresholdChange={setThreshold}
                  disabled={!entries.length || busy || recording || exporting}
                  exporting={exporting}
                  onExport={exportPassport}
                />
              }
            />
            <Route
              path="/stops/:id"
              element={
                current ? (
                  <>
                    <Link to="/" className="back-link">
                      <ArrowLeft size={16} /> Back to notebook
                    </Link>
                    <section className="recording-detail">
                      <div className="detail-header">
                        <span className="eyebrow">
                          STOP {String(entries.indexOf(current) + 1).padStart(2, '0')} /{' '}
                          {current.isVideo ? 'VIDEO' : 'AUDIO'}
                        </span>
                        <button
                          className="icon-button delete-button"
                          aria-label="Delete selected stop"
                          title="Delete stop"
                          disabled={busy || recording}
                          onClick={() => {
                            if (!confirm('Delete this stop and its recording from this device?'))
                              return;
                            setEntries((previous) =>
                              previous.filter((entry) => entry.id !== current.id),
                            );
                            navigate('/');
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <label className="visually-hidden" htmlFor="stop-title">
                        Stop title
                      </label>
                      <input
                        id="stop-title"
                        className="title-input"
                        maxLength={80}
                        value={current.title}
                        onChange={(event) => updateEntry(current.id, { title: event.target.value })}
                      />
                      <div className="place-field">
                        <MapPin size={15} />
                        <label className="visually-hidden" htmlFor="place">
                          Approximate location
                        </label>
                        <input
                          id="place"
                          maxLength={120}
                          placeholder="Approximate place (optional)"
                          value={current.place}
                          onChange={(event) =>
                            updateEntry(current.id, { place: event.target.value })
                          }
                        />
                      </div>
                      <div className="waveform-wrap">
                        <Waveform peaks={current.peaks} />
                        <div className="waveform-labels">
                          <span>0:00</span>
                          <span>{formatTime(current.analyzedDuration)}</span>
                        </div>
                      </div>
                      {current.isVideo ? (
                        <video
                          ref={player}
                          src={mediaURL || undefined}
                          controls
                          playsInline
                          preload="metadata"
                          aria-label="Original video recording"
                        />
                      ) : (
                        <audio
                          ref={player}
                          src={mediaURL || undefined}
                          controls
                          preload="metadata"
                          aria-label="Original audio recording"
                        />
                      )}
                      <div className="recording-meta">
                        <span>
                          <Volume2 size={14} /> {current.filename}
                        </span>
                        <span>
                          {current.duration.toFixed(1)}s total
                          {current.duration > 60 ? ' · first 60s analyzed' : ''}
                        </span>
                      </div>
                      <div className="analysis-action">
                        <div>
                          <span className="status-dot" />
                          <span>
                            {current.segments ? 'Analysis saved on this device' : 'Ready to listen'}
                          </span>
                        </div>
                        <button
                          className="button primary"
                          disabled={busy || recording}
                          onClick={analyze}
                        >
                          {busy ? (
                            <LoaderCircle size={17} className="spin" />
                          ) : (
                            <AudioLines size={18} />
                          )}
                          {current.segments ? 'Analyze again' : 'Find possible neighbors'}
                        </button>
                      </div>
                    </section>
                    <section className="observations">
                      <div className="tabs" role="tablist" aria-label="Recording details">
                        <button
                          role="tab"
                          aria-selected={tab === 'matches'}
                          onClick={() => setTab('matches')}
                        >
                          <Bird size={16} /> Possible matches <span>{matches.length}</span>
                        </button>
                        <button
                          role="tab"
                          aria-selected={tab === 'notes'}
                          onClick={() => setTab('notes')}
                        >
                          <Leaf size={16} /> Field notes
                        </button>
                      </div>
                      {tab === 'notes' ? (
                        <div className="notes-panel">
                          <label htmlFor="notes">Your observations</label>
                          <textarea
                            id="notes"
                            rows={7}
                            maxLength={5000}
                            placeholder="What did you hear or see?"
                            value={current.notes}
                            onChange={(event) =>
                              updateEntry(current.id, { notes: event.target.value })
                            }
                          />
                        </div>
                      ) : (
                        <div className="matches-panel">
                          <div className="filter-row">
                            <h3>
                              {current.segments
                                ? 'Who might be here?'
                                : 'A recording. A starting point.'}
                            </h3>
                            <label className="threshold">
                              Minimum score <output>{threshold.toFixed(2)}</output>
                              <input
                                aria-label="Minimum model score"
                                type="range"
                                min="0.1"
                                max="0.95"
                                step="0.05"
                                value={threshold}
                                onChange={(event) => setThreshold(Number(event.target.value))}
                              />
                            </label>
                          </div>
                          {!current.segments ? (
                            <div className="matches-empty">
                              <Bird size={37} strokeWidth={1.3} />
                              <p>No analysis yet.</p>
                            </div>
                          ) : !matches.length ? (
                            <div className="matches-empty">
                              <AudioLines size={34} />
                              <p>No matches above {threshold.toFixed(2)}.</p>
                              <small>A quiet recording is still an observation.</small>
                            </div>
                          ) : (
                            <div className="match-list">
                              {matches.map((match) => (
                                <article className="match" key={match.label}>
                                  <div className="match-icon">
                                    <Bird size={22} strokeWidth={1.4} />
                                  </div>
                                  <div className="match-name">
                                    <h4>{match.name}</h4>
                                    <p>{match.scientific}</p>
                                    <div className="moments">
                                      {match.moments.map((moment) => (
                                        <button
                                          key={moment.start}
                                          title={`Play recording at ${formatTime(moment.start)}`}
                                          aria-label={`Play ${match.name} evidence at ${formatTime(moment.start)}`}
                                          onClick={() => playMoment(moment.start)}
                                        >
                                          <Play size={11} /> {formatTime(moment.start)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="score">
                                    <strong>{match.score.toFixed(3)}</strong>
                                    <small>model score</small>
                                    <div className="score-bar">
                                      <span style={{ width: `${match.score * 100}%` }} />
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                          <p className="uncertainty">
                            Possible acoustic matches, not confirmed sightings. Scores are not
                            certainty. Wind, traffic, and overlapping calls can confuse the model.
                          </p>
                        </div>
                      )}
                    </section>
                  </>
                ) : (
                  <section className="route-empty" role="status">
                    <Bird size={32} />
                    <h3>{hydrated ? 'This stop is unavailable' : 'Opening your notebook'}</h3>
                    <p>
                      {hydrated
                        ? 'It may have been deleted or saved in a different browser.'
                        : 'Loading recordings from this device.'}
                    </p>
                    <Link to="/" className="button secondary">
                      Back to notebook
                    </Link>
                  </section>
                )
              }
            />
            <Route
              path="*"
              element={
                <section className="route-empty">
                  <h3>Page not found</h3>
                  <Link to="/" className="button secondary">
                    Back to notebook
                  </Link>
                </section>
              }
            />
          </Routes>
          <footer className="main-footer">
            <span>
              <ShieldCheck size={14} /> Recordings never leave this device unless you export them.
            </span>
            <span>
              BirdNET v2.4{' '}
              <a
                href="https://github.com/birdnet-team/BirdNET-Analyzer#license"
                target="_blank"
                rel="noreferrer"
              >
                Model license <ArrowUpRight size={12} />
              </a>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
