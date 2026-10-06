import { AudioLines, Bird, Mic, Plus, Video, ArrowUpRight, MapPin } from 'lucide-react';
import { formatTime, summarizeMatches } from '../audio.js';

export default function NotebookPage({ entries, threshold, disabled, onImport, onOpen }) {
  if (!entries.length) {
    return (
      <section className="empty-notebook">
        <div className="empty-photo">
          <img src="/field-bird.jpg" alt="A bird perched on a branch outdoors" />
          <span>
            <Bird size={16} /> The neighborhood is listening.
          </span>
        </div>
        <div className="empty-content">
          <span className="eyebrow">YOUR FIRST LISTENING STOP</span>
          <h3>Who shares your neighborhood?</h3>
          <p>Your field notebook starts with a sound.</p>
          <button className="button primary" onClick={onImport} disabled={disabled}>
            <Plus size={17} /> Add your first stop
          </button>
          <div className="empty-types">
            <span>
              <AudioLines size={16} /> Audio
            </span>
            <span>
              <Video size={16} /> Video soundtracks
            </span>
            <span>
              <Mic size={16} /> Microphone
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="notebook-page" aria-label="Your recordings">
      <div className="filter-row">
        <h3>Listening stops</h3>
        <span className="eyebrow">{entries.length} / 12 STOPS</span>
      </div>
      <div className="recording-list">
        {entries.map((entry, index) => {
          const matches = summarizeMatches(entry.segments || [], threshold);
          return (
            <button
              className="recording-row"
              key={entry.id}
              disabled={disabled}
              onClick={() => onOpen(entry.id)}
            >
              <span className="stop-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="match-icon">
                {entry.isVideo ? <Video size={22} /> : <AudioLines size={22} />}
              </span>
              <span className="recording-row-title">
                <strong>{entry.title}</strong>
                <small>
                  <MapPin size={12} /> {entry.place || 'No location added'}
                </small>
              </span>
              <span className="recording-row-status">
                <strong>{formatTime(entry.duration)}</strong>
                <small>
                  {entry.segments ? `${matches.length} possible matches` : 'Not analyzed'}
                </small>
              </span>
              <span className="mini-waveform" aria-hidden="true">
                {(entry.peaks || [])
                  .filter((_, peakIndex) => peakIndex % 6 === 0)
                  .map((peak, peakIndex) => (
                    <span
                      key={peakIndex}
                      style={{
                        height: `${Math.max(8, (peak / Math.max(...entry.peaks, 0.001)) * 100)}%`,
                      }}
                    />
                  ))}
              </span>
              <ArrowUpRight size={18} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
