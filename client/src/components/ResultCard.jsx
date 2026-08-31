import { useState } from 'react';
import MatchRing from './ui/MatchRing.jsx';
import Artwork from './ui/Artwork.jsx';
import Tags from './ui/Tags.jsx';

const DIMENSION_LABELS = {
  subject: 'Subject',
  audience: 'Audience',
  recency: 'Recency',
  geography: 'Geography',
  culture: 'Culture',
  openness: 'Openness',
  story: 'Story',
};

export default function ResultCard({
  podcast,
  isAuthed,
  isSaved,
  onToggleSave,
  onAddToPipeline,
  isComparing,
  onToggleCompare,
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card result-card">
      <Artwork src={podcast.artwork_url} alt={podcast.name} />
      <div className="result-main">
        <div className="result-top">
          <div>
            <div className="result-title-row">
              <h3 className="result-title">{podcast.name}</h3>
              {podcast.is_demo && <span className="tag tag-demo">Demo data</span>}
            </div>
            <p className="result-sub">
              {podcast.network ? `${podcast.network} · ` : ''}
              {podcast.location || podcast.geo_reach}
              {podcast.format ? ` · ${podcast.format.replace('_', '-')}` : ''}
            </p>
          </div>
          <MatchRing score={podcast.score} band={podcast.band} />
        </div>

        <p className="result-desc">{podcast.description}</p>

        <Tags items={podcast.subjects} />
        <Tags items={podcast.audiences} variant="muted" />

        <div className="result-reason">{podcast.reason}</div>

        {podcast.concerns?.length > 0 && (
          <ul className="result-concerns">
            {podcast.concerns.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}

        {expanded && (
          <>
            <p className="result-angle"><strong>Suggested angle:</strong> {podcast.angle}</p>
            <div className="breakdown-grid">
              {Object.entries(podcast.breakdown).map(([key, value]) => (
                <div className="breakdown-item" key={key}>
                  <div className="breakdown-label">{DIMENSION_LABELS[key] || key}</div>
                  <div className="breakdown-bar"><div style={{ width: `${value}%` }} /></div>
                  <div className="breakdown-value">{value}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="result-actions">
          <button className="btn btn-sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Hide details' : 'Show angle & breakdown'}
          </button>
          {podcast.website_url && (
            <a className="btn btn-sm" href={podcast.website_url} target="_blank" rel="noreferrer">Visit site</a>
          )}
          {isAuthed && (
            <>
              <button className="btn btn-sm" onClick={onToggleSave}>
                {isSaved ? '★ Saved' : '☆ Save'}
              </button>
              <button className="btn btn-sm" onClick={onAddToPipeline}>+ Pipeline</button>
            </>
          )}
          {onToggleCompare && (
            <button className={`btn btn-sm ${isComparing ? 'btn-primary' : ''}`} onClick={onToggleCompare}>
              {isComparing ? '✓ Comparing' : 'Add to compare'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
