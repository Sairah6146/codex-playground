import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import MatchRing from '../components/ui/MatchRing.jsx';

const DIMENSION_LABELS = {
  subject: 'Subject', audience: 'Audience', recency: 'Recency',
  geography: 'Geography', culture: 'Culture', openness: 'Openness', story: 'Story',
};

export default function Compare() {
  const { compareIds, toggleCompare } = useApp();
  const [allPodcasts, setAllPodcasts] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.search({}).then(({ results }) => setAllPodcasts(results)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!compareIds.length) { setRows([]); return; }
    setLoading(true);
    api.compare(compareIds).then(({ results }) => setRows(results)).finally(() => setLoading(false));
  }, [compareIds]);

  return (
    <div className="container">
      <div className="page-header">
        <h1>Compare podcasts</h1>
        <p>Pick up to 5 podcasts to line up side by side.</p>
      </div>

      <div className="compare-picker">
        {allPodcasts.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`compare-chip ${compareIds.includes(p.id) ? 'selected' : ''}`}
            onClick={() => toggleCompare(p.id)}
            disabled={!compareIds.includes(p.id) && compareIds.length >= 5}
          >
            {p.name}
          </button>
        ))}
      </div>

      {!compareIds.length && (
        <div className="empty-state">
          Select podcasts above (or use "Add to compare" on the Discover page) to compare them here.
        </div>
      )}

      {loading && <p className="hint">Loading…</p>}

      {rows.length > 0 && (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Podcast</th>
                {rows.map((r) => (
                  <th key={r.id}>
                    {r.name}
                    <div style={{ marginTop: 6 }}><MatchRing score={r.score} band={r.band} size={48} /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Network</td>
                {rows.map((r) => <td key={r.id}>{r.network || '—'}</td>)}
              </tr>
              <tr>
                <td>Reach</td>
                {rows.map((r) => <td key={r.id}>{r.geo_reach} · {r.location || '—'}</td>)}
              </tr>
              <tr>
                <td>Format</td>
                {rows.map((r) => <td key={r.id}>{r.format?.replace('_', '-') || '—'}</td>)}
              </tr>
              <tr>
                <td>Subjects</td>
                {rows.map((r) => <td key={r.id}>{r.subjects.join(', ') || '—'}</td>)}
              </tr>
              <tr>
                <td>Audiences</td>
                {rows.map((r) => <td key={r.id}>{r.audiences.join(', ') || '—'}</td>)}
              </tr>
              <tr>
                <td>Accepts guests</td>
                {rows.map((r) => <td key={r.id}>{r.accepts_guests ? 'Yes' : 'No'}</td>)}
              </tr>
              <tr>
                <td>Video</td>
                {rows.map((r) => <td key={r.id}>{r.has_video ? 'Yes' : 'No'}</td>)}
              </tr>
              {Object.keys(DIMENSION_LABELS).map((dim) => (
                <tr key={dim}>
                  <td>{DIMENSION_LABELS[dim]}</td>
                  {rows.map((r) => <td key={r.id}>{r.breakdown[dim]}</td>)}
                </tr>
              ))}
              <tr>
                <td>Suggested angle</td>
                {rows.map((r) => <td key={r.id}>{r.angle}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
