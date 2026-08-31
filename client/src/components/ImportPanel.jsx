import { useState } from 'react';
import { api } from '../api.js';

export default function ImportPanel({ onImported }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.importPodcasts(term, limit);
      setResult(data);
      if (data.imported > 0) onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setOpen((v) => !v)}
        style={{ marginBottom: open ? 12 : 0 }}
      >
        {open ? '▾' : '▸'} Import real podcasts
      </button>

      {open && (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>
            Pulls real, verified shows from Apple's Podcasts directory (plus their own RSS
            feeds for recent episodes) and adds them to the catalog — no "Demo data" tag.
          </p>
          <form onSubmit={handleSubmit} className="field-row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 2 }}>
              <label>Search term</label>
              <input
                type="text"
                placeholder="e.g. artificial intelligence, small business, parenting"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                required
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 100 }}>
              <label>How many</label>
              <input
                type="number"
                min="1"
                max="10"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: 0 }}>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </form>

          {error && <div className="error-banner">{error}</div>}

          {result && (
            <div className="error-banner" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
              {result.imported > 0 ? (
                <>Imported {result.imported}: {result.names.join(', ')}.</>
              ) : (
                <>Nothing was imported.</>
              )}
              {result.skipped?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  Skipped {result.skipped.length}: {result.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
