import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Catalog } from './Catalog';
import { DarkDropsModal } from './game/DarkDropsModal';
import {
  type JobStatus,
  type Release,
  getReleases,
  startJob,
} from './api';

const COUNTRIES = ['DE', 'AT', 'CH', 'US', 'GB', 'FR', 'ES', 'IT'];
const POLL_MS = 2000;

interface Params { date: string; country: string }
interface Job extends Params { id: string; status: JobStatus }
interface Results extends Params { releases: Release[] }

const jobLabels: Record<JobStatus, string> = {
  queued: 'In der Warteschlange …',
  running: 'Scraper läuft …',
  succeeded: 'Scraper abgeschlossen',
  failed: 'Scraper fehlgeschlagen',
};

export function App() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [country, setCountry] = useState('DE');
  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [gameOpen, setGameOpen] = useState(false);
  // Bumped on every user action; responses of older actions are dropped.
  const seq = useRef(0);
  const queryAbort = useRef<AbortController | null>(null);

  const jobId = job?.id;
  const polling = job && (job.status === 'queued' || job.status === 'running');
  const pollKey = polling ? job.id : null;

  // Poll only while a job is active; cleanup aborts in-flight requests.
  useEffect(() => {
    if (!job || !pollKey) return;
    const { id, date, country } = job;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const data = await getReleases(date, country, id, controller.signal);
        if (controller.signal.aborted) return;
        setNetError(null);
        const status = data.job?.status ?? 'running';
        setJob((j) => (j?.id === id ? { ...j, status } : j));
        if (status === 'succeeded') {
          setResults({ date, country, releases: data.releases });
          return;
        }
        if (status === 'failed') {
          setJobError(data.job?.error ?? 'Der Scraper-Lauf ist fehlgeschlagen.');
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        setNetError('Backend nicht erreichbar – neuer Versuch läuft …');
      }
      timer = setTimeout(tick, POLL_MS);
    }

    void tick();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // ponytail: keyed on job id only; date/country are captured from that job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollKey]);

  async function start() {
    if (starting) return;
    const id = ++seq.current;
    queryAbort.current?.abort();
    setStarting(true);
    setLoading(false);
    setNetError(null);
    setJobError(null);
    try {
      const { job: created } = await startJob(date, country);
      if (seq.current !== id) return;
      setResults(null);
      setJob({ id: created.id, date, country, status: 'queued' });
    } catch {
      if (seq.current === id)
        setNetError('Der Scraper konnte nicht gestartet werden. Bitte erneut versuchen.');
    } finally {
      setStarting(false);
    }
  }

  async function query() {
    const id = ++seq.current;
    queryAbort.current?.abort();
    const controller = (queryAbort.current = new AbortController());
    setJob(null); // stops polling
    setJobError(null);
    setNetError(null);
    setLoading(true);
    try {
      const data = await getReleases(date, country, undefined, controller.signal);
      if (seq.current === id) setResults({ date, country, releases: data.releases });
    } catch {
      if (seq.current === id && !controller.signal.aborted)
        setNetError('Ergebnisse konnten nicht geladen werden.');
    } finally {
      if (seq.current === id) setLoading(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void start();
  };

  return (
    <main className="page">
      <div className="progress" aria-hidden="true" />
      <header className="hero">
        <p className="eyebrow">Do we stream it?</p>
        <h1>Neue Releases, <span className="grad">auf einen Blick.</span></h1>
        <p className="lead">Finde heraus, was wo startet – Film oder Serie, Netflix bis Max.</p>
      </header>

      <form className="panel controls" onSubmit={onSubmit}>
        <label>
          Datum
          <input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Region
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button type="submit" className="primary" disabled={starting || !date}>
            {starting ? 'Startet …' : 'Start Scraper'}
          </button>
          <button type="button" className="secondary" disabled={!date} onClick={() => void query()}>
            Ergebnisse abrufen
          </button>
        </div>
      </form>

      <div className="status-area" role="status" aria-live="polite">
        {job && !jobError && (
          <p className={`pill pill--${job.status}`}>
            {polling && <span className="spinner" aria-hidden="true" />}
            {jobLabels[job.status]}
          </p>
        )}
        {loading && <p className="muted">Ergebnisse werden geladen …</p>}
      </div>

      {(jobError || netError) && (
        <div className="alert" role="alert">
          <p>{jobError ?? netError}</p>
          {!jobError && !polling && !starting && (
            <button type="button" className="secondary" onClick={() => void (jobId ? start() : query())}>
              Erneut versuchen
            </button>
          )}
          {jobError && (
            <button type="button" className="secondary" onClick={() => void start()} disabled={starting}>
              Neuen Job starten
            </button>
          )}
        </div>
      )}

      {results && !jobError && <ResultList results={results} />}

      <Catalog />

      <section className="game-teaser" aria-labelledby="game-teaser-title">
        <p className="eyebrow">DESERT STRIKES · EASTER EGG</p>
        <h2 id="game-teaser-title">Dark Drops</h2>
        <p>Während die Streams warten, gehört die Wüste dir. Weiche den Drops aus und überlebe 30 Sekunden.</p>
        <button id="dark-drops-launch" type="button" onClick={() => setGameOpen(true)}>Dark Drops spielen →</button>
      </section>
      {gameOpen && <DarkDropsModal onClose={() => setGameOpen(false)} />}
    </main>
  );
}

function ResultList({ results }: { results: Results }) {
  const { releases, date, country } = results;
  const heading = `Releases am ${date} · ${country}`;
  if (releases.length === 0)
    return (
      <section className="panel empty">
        <h2>{heading}</h2>
        <p className="muted">Keine Releases gefunden.</p>
      </section>
    );
  return (
    <section>
      <h2>{heading}</h2>
      <ul className="releases">
        {releases.map((r) => (
          <li key={r.id} className="panel release">
            <div>
              <strong>{r.title}</strong>
              <p className="muted">
                {r.platform} · {r.date} · {r.country}
              </p>
            </div>
            <span className="tag">{r.type === 'movie' ? 'Film' : 'Serie'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
