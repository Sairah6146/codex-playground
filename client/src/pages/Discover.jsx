import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import ResultCard from '../components/ResultCard.jsx';
import ImportPanel from '../components/ImportPanel.jsx';

const MODES = [
  { key: 'natural', label: 'Describe what you want' },
  { key: 'subject', label: 'By subject' },
  { key: 'audience', label: 'By audience' },
  { key: 'name', label: 'By podcast name' },
  { key: 'episode', label: 'By episode/topic text' },
  { key: 'network', label: 'By network' },
];

const PLACEHOLDERS = {
  natural: 'e.g. "an AI podcast that also touches on relationships"',
  audience: 'e.g. startup founders, seniors, parents',
  name: 'e.g. Bootstrapped',
  episode: 'e.g. swiping, balance sheet, healthy aging',
  network: 'e.g. Capital Network',
};

export default function Discover() {
  const { user, profile, savedIds, toggleSave, compareIds, toggleCompare } = useApp();
  const [mode, setMode] = useState('natural');
  const [text, setText] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [filters, setFilters] = useState({
    reach: '', format: '', audienceType: '', country: '', minScore: '', acceptsGuests: false, hasVideo: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pipelineMessage, setPipelineMessage] = useState('');

  useEffect(() => {
    api.subjects().then(({ subjects: s }) => setSubjects(s)).catch(() => {});
  }, []);

  useEffect(() => { runSearch(); /* initial load: show everything */ }, []); // eslint-disable-line

  function toggleSubjectChip(slug) {
    setSelectedSubjects((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
  }

  // What to hand Apple's directory search for the current mode/input, so a
  // signed-in search can also pull in matching real shows (see runSearch).
  function currentSearchTerm() {
    if (mode === 'subject') {
      return selectedSubjects
        .map((slug) => subjects.find((s) => s.slug === slug)?.name)
        .filter(Boolean)
        .join(' ');
    }
    return text.trim();
  }

  async function runSearch(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    // Signed-in users searching for something real: pull in matching real
    // podcasts first (best-effort — a live-fetch hiccup shouldn't block the
    // search itself), then search the now-updated catalog.
    const importTerm = currentSearchTerm();
    if (user && importTerm) {
      try {
        await api.importPodcasts(importTerm, 5);
      } catch {
        // Live source may be down or return nothing for this term — the
        // search below still runs against whatever's already in the catalog.
      }
    }

    try {
      const params = {
        reach: filters.reach, format: filters.format, audienceType: filters.audienceType,
        country: filters.country, minScore: filters.minScore,
        acceptsGuests: filters.acceptsGuests, hasVideo: filters.hasVideo,
      };
      if (mode === 'natural') params.q = text;
      if (mode === 'subject') params.subjects = selectedSubjects;
      if (mode === 'audience') params.audiences = text.split(',').map((s) => s.trim()).filter(Boolean);
      if (mode === 'name') params.name = text;
      if (mode === 'episode') params.episodeText = text;
      if (mode === 'network') params.network = text;

      const data = await api.search(params);
      setResults(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToPipeline(podcastId) {
    try {
      await api.addToPipeline(podcastId, 'researching');
      setPipelineMessage('Added to your outreach pipeline.');
      setTimeout(() => setPipelineMessage(''), 2500);
    } catch (err) {
      setError(err.message);
    }
  }

  function useMyTargets() {
    if (!profile) return;
    if (profile.target_subjects?.length) {
      setMode('subject');
      setSelectedSubjects(profile.target_subjects);
    } else if (profile.target_audiences?.length) {
      setMode('audience');
      setText(profile.target_audiences.join(', '));
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Discover podcasts</h1>
        <p>Search six ways, then let the match engine rank what's worth your time.</p>
      </div>

      {user && <ImportPanel onImported={() => runSearch()} />}

      <div className="mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`mode-tab ${mode === m.key ? 'active' : ''}`}
            onClick={() => setMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form className="search-bar" onSubmit={runSearch}>
        {mode === 'subject' ? (
          <div className="chip-input-tags" style={{ flex: 1 }}>
            {subjects.map((s) => (
              <button
                type="button"
                key={s.slug}
                className={`pill-toggle ${selectedSubjects.includes(s.slug) ? 'active' : ''}`}
                onClick={() => toggleSubjectChip(s.slug)}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDERS[mode]}
          />
        )}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? (user && currentSearchTerm() ? 'Searching (incl. real podcasts)…' : 'Searching…') : 'Search'}
        </button>
        <button type="button" className="btn" onClick={() => setShowFilters((v) => !v)}>
          Filters
        </button>
      </form>

      {user ? (
        <p className="hint" style={{ marginBottom: 12 }}>
          Signed in: each search also pulls in real, verified podcasts matching your query
          from Apple's directory (a few seconds slower — real shows may be thin for very
          specific or combined topics).
        </p>
      ) : (
        <p className="hint" style={{ marginBottom: 12 }}>
          Sign in to have search also pull in real podcasts, not just demo data.
        </p>
      )}

      {user && profile && (profile.target_subjects?.length > 0 || profile.target_audiences?.length > 0) && (
        <p className="hint" style={{ marginBottom: 12 }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={useMyTargets} style={{ padding: 0 }}>
            Use my guest profile's target subjects/audiences →
          </button>
        </p>
      )}

      {showFilters && (
        <div className="filters-panel">
          <div className="field-row">
            <div className="field">
              <label>Reach</label>
              <select value={filters.reach} onChange={(e) => setFilters({ ...filters, reach: e.target.value })}>
                <option value="">Any</option>
                <option value="local">Local</option>
                <option value="national">National</option>
                <option value="international">International</option>
              </select>
            </div>
            <div className="field">
              <label>Format</label>
              <select value={filters.format} onChange={(e) => setFilters({ ...filters, format: e.target.value })}>
                <option value="">Any</option>
                <option value="interview">Interview</option>
                <option value="co_hosted">Co-hosted</option>
                <option value="panel">Panel</option>
                <option value="solo">Solo</option>
              </select>
            </div>
            <div className="field">
              <label>Audience type</label>
              <input type="text" placeholder="e.g. founders" value={filters.audienceType}
                onChange={(e) => setFilters({ ...filters, audienceType: e.target.value })} />
            </div>
            <div className="field">
              <label>Country</label>
              <input type="text" placeholder="e.g. United States" value={filters.country}
                onChange={(e) => setFilters({ ...filters, country: e.target.value })} />
            </div>
            <div className="field">
              <label>Min match score</label>
              <input type="number" min="0" max="100" value={filters.minScore}
                onChange={(e) => setFilters({ ...filters, minScore: e.target.value })} />
            </div>
          </div>
          <div className="field-row" style={{ marginBottom: 14 }}>
            <label className="checkbox-row">
              <input type="checkbox" checked={filters.acceptsGuests}
                onChange={(e) => setFilters({ ...filters, acceptsGuests: e.target.checked })} />
              Accepts guests
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={filters.hasVideo}
                onChange={(e) => setFilters({ ...filters, hasVideo: e.target.checked })} />
              Has video
            </label>
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {pipelineMessage && <div className="error-banner" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{pipelineMessage}</div>}

      {results && (
        <div className="results-meta">
          <span>{results.length} podcast{results.length === 1 ? '' : 's'}</span>
          {compareIds.length > 0 && <span>{compareIds.length} selected for compare</span>}
        </div>
      )}

      <div className="results-grid">
        {results?.length === 0 && (
          <div className="empty-state">
            {user
              ? "No real podcasts matched that yet. Try a broader or different search term — each search pulls in new real results from Apple's directory."
              : 'No podcasts matched that search yet. Sign in to have search also pull in real podcasts for this topic.'}
          </div>
        )}
        {results?.map((podcast) => (
          <ResultCard
            key={podcast.id}
            podcast={podcast}
            isAuthed={!!user}
            isSaved={savedIds.has(podcast.id)}
            onToggleSave={() => toggleSave(podcast.id)}
            onAddToPipeline={() => handleAddToPipeline(podcast.id)}
            isComparing={compareIds.includes(podcast.id)}
            onToggleCompare={() => toggleCompare(podcast.id)}
          />
        ))}
      </div>
    </div>
  );
}
