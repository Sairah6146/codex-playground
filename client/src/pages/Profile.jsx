import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

function ChipInput({ label, values, onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn btn-sm" onClick={add}>Add</button>
      </div>
      <div className="chip-input-tags">
        {values.map((v) => (
          <span className="chip-input-tag" key={v}>
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { profile, refreshProfile } = useApp();
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({
    professional_title: '', personal_story: '', promoting: '',
    expertise: [], previous_interviews: [], target_subjects: [], target_audiences: [],
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.subjects().then(({ subjects: s }) => setSubjects(s)).catch(() => {});
  }, []);

  useEffect(() => {
    if (profile) {
      setForm({
        professional_title: profile.professional_title || '',
        personal_story: profile.personal_story || '',
        promoting: profile.promoting || '',
        expertise: profile.expertise || [],
        previous_interviews: profile.previous_interviews || [],
        target_subjects: profile.target_subjects || [],
        target_audiences: profile.target_audiences || [],
      });
    }
  }, [profile]);

  function toggleTargetSubject(slug) {
    setForm((f) => ({
      ...f,
      target_subjects: f.target_subjects.includes(slug)
        ? f.target_subjects.filter((s) => s !== slug)
        : [...f.target_subjects, slug],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      await api.saveProfile(form);
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Guest profile</h1>
        <p>This feeds the "story" scoring dimension and can pre-fill your searches.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {saved && <div className="error-banner" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>Profile saved.</div>}

      <form className="card" style={{ maxWidth: 640 }} onSubmit={handleSubmit}>
        <div className="field">
          <label>Professional title</label>
          <input type="text" placeholder="e.g. Founder & CEO, Acme Robotics"
            value={form.professional_title}
            onChange={(e) => setForm({ ...form, professional_title: e.target.value })} />
        </div>

        <div className="field">
          <label>Your story</label>
          <textarea placeholder="What's the story you want to tell on a podcast?"
            value={form.personal_story}
            onChange={(e) => setForm({ ...form, personal_story: e.target.value })} />
        </div>

        <div className="field">
          <label>What you're promoting</label>
          <input type="text" placeholder="e.g. a book, a launch, a cause"
            value={form.promoting}
            onChange={(e) => setForm({ ...form, promoting: e.target.value })} />
        </div>

        <ChipInput label="Areas of expertise" values={form.expertise}
          onChange={(v) => setForm({ ...form, expertise: v })} placeholder="e.g. machine learning" />

        <ChipInput label="Previous interviews" values={form.previous_interviews}
          onChange={(v) => setForm({ ...form, previous_interviews: v })} placeholder="show name or URL" />

        <ChipInput label="Target audiences" values={form.target_audiences}
          onChange={(v) => setForm({ ...form, target_audiences: v })} placeholder="e.g. startup founders" />

        <div className="field">
          <label>Target subjects</label>
          <div className="chip-input-tags">
            {subjects.map((s) => (
              <button type="button" key={s.slug}
                className={`pill-toggle ${form.target_subjects.includes(s.slug) ? 'active' : ''}`}
                onClick={() => toggleTargetSubject(s.slug)}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
