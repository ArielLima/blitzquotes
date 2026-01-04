import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.EXPO_PUBLIC_SUPABASE_URL,
  import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

function getDefaultStartDate() {
  const d = new Date();
  d.setHours(d.getHours() - 24);
  return d.toISOString().slice(0, 16);
}

function getDefaultEndDate() {
  return new Date().toISOString().slice(0, 16);
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function App() {
  const [searchId, setSearchId] = useState('');
  const [recentTraces, setRecentTraces] = useState([]);
  const [currentTrace, setCurrentTrace] = useState(null);
  const [currentSource, setCurrentSource] = useState(null);
  const [steps, setSteps] = useState([]);
  const [openSteps, setOpenSteps] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [sourceFilter, setSourceFilter] = useState('');
  const [availableSources, setAvailableSources] = useState([]);
  const [copied, setCopied] = useState(false);

  // Load recent traces and available sources on mount
  useEffect(() => {
    loadRecent();
    loadSources();
  }, []);

  async function loadSources() {
    const { data } = await supabase
      .from('quote_traces')
      .select('source')
      .not('source', 'is', null);

    if (data) {
      const unique = [...new Set(data.map(r => r.source).filter(Boolean))];
      setAvailableSources(unique.sort());
    }
  }

  async function loadRecent() {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('quote_traces')
      .select('trace_id, source, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    // Apply date range filter
    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', new Date(endDate).toISOString());
    }
    if (sourceFilter) {
      query = query.eq('source', sourceFilter);
    }

    const { data, error: err } = await query;

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Group by trace_id, keep source and time
    const seen = new Map();
    data?.forEach(row => {
      if (!seen.has(row.trace_id)) {
        seen.set(row.trace_id, { time: row.created_at, source: row.source });
      }
    });

    setRecentTraces(Array.from(seen.entries()).slice(0, 30));
    setLoading(false);
  }

  function copyTrace() {
    const traceData = {
      trace_id: currentTrace,
      source: currentSource,
      total_duration_ms: steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0),
      steps: steps.map(s => ({
        step: s.step,
        step_number: s.step_number,
        duration_ms: s.duration_ms,
        input: s.input,
        output: s.output,
        error: s.error,
      })),
    };

    const text = `# Trace ${currentTrace}${currentSource ? ` (${currentSource})` : ''}\n\n\`\`\`json\n${JSON.stringify(traceData, null, 2)}\n\`\`\``;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function loadTrace(traceId) {
    setLoading(true);
    setCurrentTrace(traceId);
    setCurrentSource(null);
    setOpenSteps({});

    const { data, error: err } = await supabase
      .from('quote_traces')
      .select('*')
      .eq('trace_id', traceId)
      .order('step_number', { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSteps(data || []);
    if (data?.[0]?.source) {
      setCurrentSource(data[0].source);
    }
    setLoading(false);
  }

  function toggleStep(id) {
    setOpenSteps(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const totalMs = steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0);

  return (
    <div className="container">
      <h1>Trace Viewer</h1>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Enter trace ID..."
          value={searchId}
          onChange={e => setSearchId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchId && loadTrace(searchId)}
        />
        <button onClick={() => searchId && loadTrace(searchId)}>Load</button>
        <button className="secondary" onClick={loadRecent}>Refresh</button>
      </div>

      {error && <div className="empty">Error: {error}</div>}

      {!currentTrace && (
        <div className="recent">
          <div className="recent-header">
            <h2>Recent Traces</h2>
            <div className="date-filter">
              <label>
                From
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </label>
              <label>
                Source
                <select
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {availableSources.map(src => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </label>
              <button onClick={loadRecent}>Filter</button>
            </div>
          </div>
          <div className="chips">
            {loading && <span>Loading...</span>}
            {!loading && recentTraces.length === 0 && (
              <span>No traces in this date range.</span>
            )}
            {recentTraces.map(([id, { time, source }]) => (
              <div key={id} className="chip" onClick={() => loadTrace(id)}>
                {source && <span className="source-tag">{source}</span>}
                {id.slice(0, 8)}
                <span className="time">{timeAgo(time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentTrace && (
        <>
          <div className="trace-header">
            <div>
              <div className="trace-id">
                {currentSource && <span className="source-tag">{currentSource}</span>}
                {currentTrace}
              </div>
              {steps[0] && (
                <div className="meta">{new Date(steps[0].created_at).toLocaleString()}</div>
              )}
            </div>
            <div className="trace-actions">
              <span className="meta">Total: {totalMs}ms</span>
              <button
                className="secondary"
                onClick={copyTrace}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                className="secondary"
                onClick={() => { setCurrentTrace(null); setCurrentSource(null); setSteps([]); }}
              >
                Back
              </button>
            </div>
          </div>

          <div className="steps">
            {steps.map(step => {
              const isOpen = openSteps[step.id];
              const durationClass = step.duration_ms > 5000 ? 'very-slow' : step.duration_ms > 2000 ? 'slow' : '';

              return (
                <div key={step.id} className={`step ${step.error ? 'error' : ''}`}>
                  <div className="step-header" onClick={() => toggleStep(step.id)}>
                    <div className="step-name">
                      <span className={`status ${step.error ? 'err' : 'ok'}`} />
                      <span className="step-num">{step.step_number}</span>
                      {step.step}
                    </div>
                    <span className={`duration ${durationClass}`}>{step.duration_ms}ms</span>
                  </div>

                  {isOpen && (
                    <div className="step-body">
                      {step.input && (
                        <div className="json-section">
                          <div className="json-label">Input</div>
                          <div className="json-content">
                            {JSON.stringify(step.input, null, 2)}
                          </div>
                        </div>
                      )}
                      {step.output && (
                        <div className="json-section">
                          <div className="json-label">Output</div>
                          <div className="json-content">
                            {JSON.stringify(step.output, null, 2)}
                          </div>
                        </div>
                      )}
                      {step.error && (
                        <div className="json-section">
                          <div className="json-label">Error</div>
                          <div className="json-content error">{step.error}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
