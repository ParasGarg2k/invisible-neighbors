import { Link } from 'react-router-dom';
import { Bird, Download, LoaderCircle, MapPin, ArrowUpRight, BookOpen } from 'lucide-react';
import { summarizeMatches, formatTime } from '../audio.js';

export default function PassportPage({
  entries,
  threshold,
  onThresholdChange,
  disabled,
  exporting,
  onExport,
}) {
  const discoveries = new Map();
  for (const entry of entries) {
    for (const match of summarizeMatches(entry.segments || [], threshold)) {
      const discovery = discoveries.get(match.label) || { ...match, stops: [], score: 0 };
      discovery.score = Math.max(discovery.score, match.score);
      discovery.stops.push({ id: entry.id, title: entry.title, place: entry.place });
      discoveries.set(match.label, discovery);
    }
  }
  const neighbors = [...discoveries.values()].sort((first, second) => second.score - first.score);
  const analyzed = entries.filter((entry) => entry.segments).length;

  return (
    <section className="passport-page">
      <div className="passport-heading">
        <div>
          <span className="eyebrow">COLLECTED ON THIS DEVICE</span>
          <h3>A record of your listening</h3>
        </div>
        <button className="button primary" disabled={disabled} onClick={onExport}>
          {exporting ? <LoaderCircle size={17} className="spin" /> : <Download size={17} />} Export
          passport
        </button>
      </div>
      <div className="passport-completion">
        <span>
          {analyzed} of {entries.length} stops analyzed
        </span>
        <progress
          aria-label="Analyzed listening stops"
          max={Math.max(entries.length, 1)}
          value={analyzed}
        />
      </div>
      <div className="filter-row">
        <h3>
          Possible neighbors <span className="eyebrow">{neighbors.length}</span>
        </h3>
        <label className="threshold">
          Minimum score <output>{threshold.toFixed(2)}</output>
          <input
            aria-label="Minimum passport model score"
            type="range"
            min="0.1"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(event) => onThresholdChange(Number(event.target.value))}
          />
        </label>
      </div>
      {!neighbors.length ? (
        <div className="route-empty">
          <Bird size={36} />
          <h3>{entries.length ? 'No matches at this score yet' : 'Your passport is waiting'}</h3>
          <p>
            {entries.length
              ? 'Your recordings and field notes still belong in your report.'
              : 'No listening stops collected yet.'}
          </p>
          <Link to="/" className="button secondary">
            Open notebook <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="match-list">
          {neighbors.map((neighbor) => (
            <article className="match" key={neighbor.label}>
              <div className="match-icon">
                <Bird size={22} />
              </div>
              <div className="match-name">
                <h4>{neighbor.name}</h4>
                <p>{neighbor.scientific}</p>
                <div className="passport-stop-links">
                  {neighbor.stops.map((stop) => (
                    <Link key={stop.id} to={`/stops/${stop.id}`}>
                      <MapPin size={13} />
                      <span>{stop.place || stop.title}</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  ))}
                </div>
              </div>
              <div className="score">
                <strong>{neighbor.score.toFixed(3)}</strong>
                <small>model score</small>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="uncertainty">
        Possible acoustic matches, not confirmed sightings. Scores are not certainty. The passport
        includes your original recordings and field notes.
      </p>
      {entries.length > 0 && (
        <section className="passport-journal" aria-label="Collected field notes">
          <div className="filter-row">
            <h3>From the field</h3>
            <BookOpen size={19} />
          </div>
          {entries.map((entry, index) => (
            <article className="journal-entry" key={entry.id}>
              <span className="journal-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <Link to={`/stops/${entry.id}`} className="journal-title">
                  {entry.title}
                  <ArrowUpRight size={15} />
                </Link>
                <p className="journal-meta">
                  {entry.place || 'Location not added'} · {formatTime(entry.duration)} ·{' '}
                  {new Date(entry.createdAt).toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <p className={`journal-notes ${entry.notes ? '' : 'no-notes'}`}>
                  {entry.notes || 'No field notes added.'}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
