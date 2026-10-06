import { useEffect, useState } from 'react';

type ApiStatus = 'loading' | 'online' | 'offline';

const statusLabels: Record<ApiStatus, string> = {
  loading: 'Backend wird verbunden …',
  online: 'Backend ist online',
  offline: 'Backend ist nicht erreichbar',
};

export function App() {
  const [status, setStatus] = useState<ApiStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function checkHealth() {
      try {
        const response = await fetch('/api/health', {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Health request failed.');

        const data: unknown = await response.json();
        if (
          typeof data !== 'object' ||
          data === null ||
          !('status' in data) ||
          data.status !== 'ok'
        ) {
          throw new Error('Unexpected health response.');
        }

        if (!controller.signal.aborted) setStatus('online');
      } catch {
        if (!controller.signal.aborted) setStatus('offline');
      }
    }

    void checkHealth();
    return () => controller.abort();
  }, [attempt]);

  return (
    <main className="card">
      <p className="eyebrow">DO WE STREAM IT?</p>
      <h1>Ready to build.</h1>
      <p className="intro">
        React im Frontend. Fastify im Backend. TypeScript überall.
      </p>
      <div className="stack" aria-label="Technologien">
        <span>React</span>
        <span>Fastify</span>
        <span>TypeScript</span>
      </div>
      <div className="connection">
        <p className={`status status--${status}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {statusLabels[status]}
        </p>
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => {
            setStatus('loading');
            setAttempt((value) => value + 1);
          }}
        >
          Verbindung prüfen
        </button>
      </div>
    </main>
  );
}
