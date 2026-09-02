import React, { useState } from "react";

// ============================================================================
// LAYER 2 — BUILD
// The Resonance Mapper for "The Pharaoh's Call"
// Turns the Layer 1 prompts into a running tool. Finds PUBLIC communities and
// organizations aligned with the book's thesis — the compliant, opt-in path
// to lead generation. No private-individual profiling.
//
// Calls the backend's /api/resonance proxy (see ../../src/app.js) instead of
// api.anthropic.com directly, so the Anthropic API key stays server-side.
// ============================================================================

const BOOK_THESIS = `The book "The Pharaoh's Call: Why Black America's Leadership Must Shape the AI Age" (pharaohscall.com) argues that Black America has an ancestral legacy of innovation and must lead in the AI age — reclaiming technological sovereignty, driving economic mobility, and bridging generations, faith communities, and the broader tech world.`;

const MODES = {
  communities: {
    label: "Communities & conversations",
    hint: "Public groups, channels, shows, and threads where the thesis resonates",
    buildPrompt: (focus) => `You are a community research strategist.

${BOOK_THESIS}

TASK: Identify PUBLIC communities and conversations where this thesis resonates${focus ? `, with emphasis on: ${focus}` : ""}. Consider Reddit, YouTube, Facebook Groups, LinkedIn, Substack, and podcasts.

Return ONLY a JSON array (no prose, no markdown fences). 8 items. Each object:
{
 "name": string,
 "platform": string,
 "reach": string,               // approx size / activity, or "n/a"
 "topics": string,              // primary topics
 "angle": string,              // the SPECIFIC book theme that connects
 "norms": string,              // participation norms so outreach isn't spam
 "move": string,               // best contribution: comment / post / AMA / guest / partnership
 "fit": number                 // 1-5 alignment strength
}
Rules: public aggregate info only; never list private individuals or personal contact details. If a field is unknown use "n/a". Sort by fit descending.`,
  },
  organizations: {
    label: "Organizations & leaders",
    hint: "Churches, HBCUs, chambers, associations, nonprofits — entities with public contacts",
    buildPrompt: (focus) => `You are a partnerships research strategist.

${BOOK_THESIS}

TASK: Identify ORGANIZATIONS whose public mission aligns with the book${focus ? `, with emphasis on: ${focus}` : ""}. Target churches & faith networks, HBCU programs, Black chambers of commerce, professional associations (NSBE, BDPA, AABE), tech-equity nonprofits, Divine Nine orgs, Black-owned media/podcasts.

Return ONLY a JSON array (no prose, no markdown fences). 8 items. Each object:
{
 "name": string,
 "platform": string,           // type of organization
 "reach": string,              // local / regional / national, or "n/a"
 "topics": string,             // one-line public mission
 "angle": string,              // alignment angle from the book
 "norms": string,              // public contact channel type (org email / form / public phone) — NEVER a private person's
 "move": string,               // suggested collaboration (bulk order, talk, workshop, book-club kit, co-branded event)
 "fit": number                 // 1-5 warmth score
}
Rules: organizations and their PUBLIC business contact channels only — never a private individual's personal details. Unknown field → "n/a". Sort by fit descending.`,
  },
};

async function callResonanceProxy(prompt) {
  const res = await fetch("/api/resonance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data.text || "";
}

function FitDots({ n }) {
  return (
    <span style={{ letterSpacing: 2 }} aria-label={`fit ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= n ? "#C6A15B" : "#2a2f3a" }}>●</span>
      ))}
    </span>
  );
}

export default function ResonanceMapper() {
  const [mode, setMode] = useState("communities");
  const [focus, setFocus] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drafting, setDrafting] = useState(null); // row index being drafted for
  const [draft, setDraft] = useState({});         // index -> message text
  const [saved, setSaved] = useState([]);         // rows saved to the tracker across runs
  const [toast, setToast] = useState("");

  // --- CSV helpers -----------------------------------------------------------
  const CSV_COLUMNS = [
    ["type", "Type"], ["name", "Name"], ["platform", "Platform / Org type"],
    ["reach", "Reach"], ["topics", "Talks about / Mission"],
    ["angle", "Connection angle"], ["norms", "How to reach / norms"],
    ["move", "Best move"], ["fit", "Fit / Warmth"],
    ["outreach", "Drafted outreach"], ["status", "Status"], ["captured", "Captured"],
  ];

  function csvEscape(val) {
    const s = String(val == null ? "" : val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toCSV(items) {
    const header = CSV_COLUMNS.map(([, label]) => csvEscape(label)).join(",");
    const lines = items.map((r) =>
      CSV_COLUMNS.map(([key]) => csvEscape(r[key])).join(",")
    );
    return [header, ...lines].join("\n");
  }

  function downloadCSV(items, filename) {
    if (!items.length) { flash("Nothing to export yet."); return; }
    const blob = new Blob([toCSV(items)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function flash(msg) { setToast(msg); setTimeout(() => setToast(""), 2200); }

  function rowToTracker(row) {
    return {
      type: mode === "communities" ? "Community" : "Organization",
      name: row.name, platform: row.platform, reach: row.reach,
      topics: row.topics, angle: row.angle, norms: row.norms,
      move: row.move, fit: row.fit,
      outreach: "", // filled if/when drafted, see saveRow
      status: "AWAITING APPROVAL",
      captured: new Date().toISOString().slice(0, 10),
    };
  }

  function isSaved(row) {
    return saved.some((s) => s.name === row.name && s.platform === row.platform);
  }

  function saveRow(idx) {
    const row = rows[idx];
    if (isSaved(row)) { flash("Already in tracker."); return; }
    const entry = rowToTracker(row);
    if (draft[idx]) entry.outreach = draft[idx];
    setSaved((s) => [...s, entry]);
    flash(`Saved "${row.name}" to tracker.`);
  }

  function saveAll() {
    const fresh = rows
      .filter((r) => !isSaved(r))
      .map((r) => {
        const entry = rowToTracker(r);
        const realIdx = rows.indexOf(r);
        if (draft[realIdx]) entry.outreach = draft[realIdx];
        return entry;
      });
    if (!fresh.length) { flash("All of these are already saved."); return; }
    setSaved((s) => [...s, ...fresh]);
    flash(`Saved ${fresh.length} to tracker.`);
  }

  function clearTracker() {
    if (saved.length) { setSaved([]); flash("Tracker cleared."); }
  }

  async function runMap() {
    setLoading(true);
    setError("");
    setRows([]);
    setDraft({});
    try {
      const text = await callResonanceProxy(MODES[mode].buildPrompt(focus.trim()));
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setRows(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      setError(e.message || "Couldn't build the map. Try again, or narrow the focus field.");
    } finally {
      setLoading(false);
    }
  }

  async function draftOutreach(idx) {
    const row = rows[idx];
    setDrafting(idx);
    try {
      const prompt = `${BOOK_THESIS}

Draft a short, warm, platform-appropriate outreach message to this ${mode === "communities" ? "community" : "organization"}:
Name: ${row.name}
Platform/type: ${row.platform}
Their focus: ${row.topics}
Connection angle: ${row.angle}
Norms/contact: ${row.norms}
Suggested move: ${row.move}

One message, under 90 words. Value-first, respects their norms, one concrete hook from the book, ends with a single next step routing to pharaohscall.com. No spam, no false urgency. Return only the message.`;
      const text = await callResonanceProxy(prompt);
      setDraft((d) => ({ ...d, [idx]: text.trim() }));
    } catch (e) {
      setDraft((d) => ({ ...d, [idx]: e.message || "Couldn't draft — try again." }));
    } finally {
      setDrafting(null);
    }
  }

  return (
    <div style={{
      minHeight: "100%", background: "#0E1116", color: "#E8E4DA",
      fontFamily: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
      padding: "32px 20px",
    }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ borderBottom: "1px solid #C6A15B", paddingBottom: 18, marginBottom: 26 }}>
          <div style={{ fontSize: 13, color: "#C6A15B", fontFamily: "ui-sans-serif, system-ui" }}>
            The Pharaoh&rsquo;s Call &nbsp;·&nbsp; Revenue Stack Layer 2 — Build
          </div>
          <h1 style={{ fontSize: 38, margin: "8px 0 4px", fontWeight: 600, lineHeight: 1.1 }}>
            The Resonance Mapper
          </h1>
          <p style={{ margin: 0, color: "#A9A395", fontSize: 16, maxWidth: 640 }}>
            Find the public communities and organizations already talking about
            what your book is about — then reach them the way they want to be reached.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}>
          <div>
            <div style={labelStyle}>What to map</div>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(MODES).map(([k, v]) => (
                <button key={k} onClick={() => { setMode(k); setRows([]); }}
                  style={{
                    ...pillStyle,
                    background: mode === k ? "#C6A15B" : "transparent",
                    color: mode === k ? "#0E1116" : "#E8E4DA",
                    borderColor: mode === k ? "#C6A15B" : "#3a3f4a",
                  }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={labelStyle}>Narrow the focus (optional)</div>
            <input value={focus} onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. faith communities, HBCUs, entrepreneurs"
              style={inputStyle} />
          </div>
          <button onClick={runMap} disabled={loading} style={{ ...ctaStyle, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Mapping…" : "Build the map"}
          </button>
        </div>
        <div style={{ color: "#7d7869", fontSize: 13, marginBottom: 22, fontFamily: "ui-sans-serif, system-ui" }}>
          {MODES[mode].hint}. Public information only — no private-individual profiling.
        </div>

        {error && <div style={{ color: "#E0A46B", marginBottom: 16 }}>{error}</div>}

        {/* Results header actions */}
        {rows.length > 0 && (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "#7d7869", fontSize: 13, fontFamily: "ui-sans-serif, system-ui", marginRight: "auto" }}>
              {rows.length} results
            </span>
            <button onClick={saveAll} style={ghostStyle}>Save all to tracker</button>
            <button onClick={() => downloadCSV(rows.map(rowToTracker), `pharaohs-call-${mode}-${new Date().toISOString().slice(0,10)}.csv`)}
              style={ghostStyle}>Export this map (CSV)</button>
          </div>
        )}

        {/* Results */}
        {rows.map((row, idx) => (
          <div key={idx} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div style={{ fontSize: 21, fontWeight: 600 }}>{row.name}</div>
              <FitDots n={Number(row.fit) || 0} />
            </div>
            <div style={{ color: "#C6A15B", fontSize: 13, fontFamily: "ui-sans-serif, system-ui", margin: "2px 0 12px" }}>
              {row.platform} &nbsp;·&nbsp; {row.reach}
            </div>
            <Field k="Talks about" v={row.topics} />
            <Field k="Why it connects" v={row.angle} />
            <Field k="How to reach / norms" v={row.norms} />
            <Field k="Best move" v={row.move} />

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => draftOutreach(idx)} disabled={drafting === idx} style={ghostStyle}>
                {drafting === idx ? "Drafting…" : "Draft outreach"}
              </button>
              <button onClick={() => saveRow(idx)} disabled={isSaved(row)}
                style={{ ...ghostStyle, opacity: isSaved(row) ? 0.5 : 1 }}>
                {isSaved(row) ? "In tracker ✓" : "Save to tracker"}
              </button>
            </div>

            {draft[idx] && (
              <div style={{
                marginTop: 12, padding: 14, background: "#12161d",
                borderLeft: "2px solid #C6A15B", fontSize: 15, lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}>
                {draft[idx]}
              </div>
            )}
          </div>
        ))}

        {!rows.length && !loading && (
          <div style={{ ...cardStyle, color: "#7d7869", textAlign: "center", padding: "40px 20px" }}>
            Choose what to map and press <strong style={{ color: "#C6A15B" }}>Build the map</strong>.
            The results become your Layer 3 agent&rsquo;s daily worklist.
          </div>
        )}

        <div style={{ marginTop: 24, color: "#5f5b50", fontSize: 12, fontFamily: "ui-sans-serif, system-ui", textAlign: "center" }}>
          Compliant by design: surfaces public communities & organizations, builds an opt-in audience you own.
        </div>
      </div>

      {/* Persistent tracker bar — the bridge to the Layer 3 agent */}
      {saved.length > 0 && (
        <div style={{
          position: "sticky", bottom: 0, left: 0, right: 0, marginTop: 20,
          background: "#12161d", borderTop: "1px solid #C6A15B",
          padding: "12px 20px", display: "flex", alignItems: "center", gap: 12,
          flexWrap: "wrap", fontFamily: "ui-sans-serif, system-ui",
        }}>
          <div style={{ maxWidth: 940, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ color: "#E8E4DA", fontSize: 14 }}>
              <strong style={{ color: "#C6A15B" }}>{saved.length}</strong> saved to tracker
              <span style={{ color: "#7d7869" }}> · communities &amp; organizations combined</span>
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => downloadCSV(saved, `pharaohs-call-tracker-${new Date().toISOString().slice(0,10)}.csv`)}
                style={ctaStyle}>Export tracker for agent (CSV)</button>
              <button onClick={clearTracker} style={{ ...ghostStyle, borderColor: "#3a3f4a", color: "#A9A395" }}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 78, left: "50%", transform: "translateX(-50%)",
          background: "#C6A15B", color: "#0E1116", padding: "9px 16px", borderRadius: 3,
          fontSize: 14, fontFamily: "ui-sans-serif, system-ui", fontWeight: 600,
          boxShadow: "0 4px 14px rgba(0,0,0,0.4)", zIndex: 50,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({ k, v }) {
  return (
    <div style={{ marginBottom: 7, fontSize: 15, lineHeight: 1.45 }}>
      <span style={{ fontFamily: "ui-sans-serif, system-ui", fontSize: 12, color: "#7d7869" }}>{k}: </span>
      <span>{v}</span>
    </div>
  );
}

const labelStyle = { fontSize: 12, color: "#7d7869", marginBottom: 6, fontFamily: "ui-sans-serif, system-ui" };
const pillStyle = { padding: "9px 14px", border: "1px solid", borderRadius: 2, cursor: "pointer", fontSize: 14, fontFamily: "ui-sans-serif, system-ui" };
const inputStyle = { width: "100%", padding: "10px 12px", background: "#12161d", border: "1px solid #3a3f4a", borderRadius: 2, color: "#E8E4DA", fontSize: 15, fontFamily: "ui-sans-serif, system-ui", boxSizing: "border-box" };
const ctaStyle = { padding: "11px 22px", background: "#C6A15B", color: "#0E1116", border: "none", borderRadius: 2, cursor: "pointer", fontSize: 15, fontWeight: 600, fontFamily: "ui-sans-serif, system-ui" };
const ghostStyle = { padding: "8px 14px", background: "transparent", color: "#C6A15B", border: "1px solid #C6A15B", borderRadius: 2, cursor: "pointer", fontSize: 13, fontFamily: "ui-sans-serif, system-ui" };
const cardStyle = { background: "#161a21", border: "1px solid #232833", borderRadius: 3, padding: 20, marginBottom: 14 };
