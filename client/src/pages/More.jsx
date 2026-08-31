import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import ResultCard from '../components/ResultCard.jsx';
import Artwork from '../components/ui/Artwork.jsx';

const STAGES = ['researching', 'pitched', 'booked', 'declined'];
const STAGE_LABELS = { researching: 'Researching', pitched: 'Pitched', booked: 'Booked', declined: 'Declined' };

function HomeTab({ saved, pipeline }) {
  const counts = STAGES.reduce((acc, s) => ({ ...acc, [s]: pipeline.filter((p) => p.stage === s).length }), {});
  return (
    <div>
      <div className="breakdown-grid" style={{ marginBottom: 24 }}>
        <div className="card"><h3 style={{ margin: 0 }}>{saved.length}</h3><span className="hint">Saved podcasts</span></div>
        {STAGES.map((s) => (
          <div className="card" key={s}><h3 style={{ margin: 0 }}>{counts[s]}</h3><span className="hint">{STAGE_LABELS[s]}</span></div>
        ))}
      </div>
      <p className="hint">
        Head to <strong>Discover</strong> to search, save podcasts you like, and drop the
        strongest matches into your pipeline.
      </p>
    </div>
  );
}

function SavedTab({ saved, onUnsave, onAddToPipeline }) {
  if (!saved.length) return <div className="empty-state">No saved podcasts yet. Save some from Discover.</div>;
  return (
    <div className="results-grid">
      {saved.map((podcast) => (
        <ResultCard
          key={podcast.id}
          podcast={podcast}
          isAuthed
          isSaved
          onToggleSave={() => onUnsave(podcast.id)}
          onAddToPipeline={() => onAddToPipeline(podcast.id)}
        />
      ))}
    </div>
  );
}

function PipelineTab({ items, onUpdate, onRemove }) {
  return (
    <div className="pipeline-board">
      {STAGES.map((stage) => (
        <div className="pipeline-column" key={stage}>
          <h3>{STAGE_LABELS[stage]} ({items.filter((i) => i.stage === stage).length})</h3>
          {items.filter((i) => i.stage === stage).map((item) => (
            <div className="pipeline-item" key={item.id}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <Artwork src={item.artwork_url} alt={item.podcast_name} size={32} />
                <span className="pipeline-item-title">{item.podcast_name}</span>
              </div>
              {item.notes && <p className="hint" style={{ marginBottom: 6 }}>{item.notes}</p>}
              <div className="pipeline-item-actions">
                <select value={item.stage} onChange={(e) => onUpdate(item.id, { stage: e.target.value })}>
                  {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
                <button className="btn btn-sm" onClick={() => onRemove(item.id)}>Remove</button>
              </div>
            </div>
          ))}
          {items.filter((i) => i.stage === stage).length === 0 && (
            <p className="hint">Nothing here yet.</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function More() {
  const { toggleSave } = useApp();
  const [tab, setTab] = useState('home');
  const [saved, setSaved] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [error, setError] = useState('');

  async function loadSaved() {
    const { results } = await api.saved();
    setSaved(results);
  }
  async function loadPipeline() {
    const { items } = await api.pipeline();
    setPipeline(items);
  }

  useEffect(() => {
    Promise.all([loadSaved(), loadPipeline()]).catch((err) => setError(err.message));
  }, []);

  async function handleUnsave(podcastId) {
    await toggleSave(podcastId);
    loadSaved();
  }
  async function handleAddToPipeline(podcastId) {
    await api.addToPipeline(podcastId, 'researching');
    loadPipeline();
  }
  async function handleUpdatePipeline(id, patch) {
    await api.updatePipelineItem(id, patch);
    loadPipeline();
  }
  async function handleRemovePipeline(id) {
    await api.removeFromPipeline(id);
    loadPipeline();
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Saved &amp; pipeline</h1>
        <p>Your saved podcasts and a simple outreach pipeline.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="tabs">
        <div className={`tab ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>Home</div>
        <div className={`tab ${tab === 'saved' ? 'active' : ''}`} onClick={() => setTab('saved')}>Saved ({saved.length})</div>
        <div className={`tab ${tab === 'pipeline' ? 'active' : ''}`} onClick={() => setTab('pipeline')}>Pipeline ({pipeline.length})</div>
      </div>

      {tab === 'home' && <HomeTab saved={saved} pipeline={pipeline} />}
      {tab === 'saved' && <SavedTab saved={saved} onUnsave={handleUnsave} onAddToPipeline={handleAddToPipeline} />}
      {tab === 'pipeline' && <PipelineTab items={pipeline} onUpdate={handleUpdatePipeline} onRemove={handleRemovePipeline} />}
    </div>
  );
}
