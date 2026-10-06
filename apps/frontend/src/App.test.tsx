// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from './App';

const rel = { id: '1', title: 'Dune', type: 'movie', platform: 'Max', date: '2026-10-06', country: 'DE' };
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mock(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(handler);
  vi.stubGlobal('fetch', fn);
  return fn;
}
const posts = (fn: ReturnType<typeof mock>) => fn.mock.calls.filter(([, i]) => i?.method === 'POST').length;

test('start → succeeded → shows releases; two clicks = two jobs', async () => {
  let n = 0;
  const fn = mock((url, init) =>
    init?.method === 'POST'
      ? ok({ job: { id: `j${++n}`, status: 'queued' } })
      : ok({ job: { id: 'j', status: 'succeeded' }, releases: [rel] }),
  );
  render(<App />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Start Scraper' }));
  expect(await screen.findByText('Dune')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Start Scraper' }));
  await waitFor(() => expect(posts(fn)).toBe(2));
});

test('zero results', async () => {
  mock(() => ok({ releases: [] }));
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Ergebnisse abrufen' }));
  expect(await screen.findByText('Keine Releases gefunden.')).toBeTruthy();
});

test('failed job', async () => {
  mock((_u, init) =>
    init?.method === 'POST' ? ok({ job: { id: 'j', status: 'queued' } }) : ok({ job: { id: 'j', status: 'failed', error: 'Quelle down' }, releases: [] }),
  );
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Start Scraper' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Quelle down');
});

test('network error is not an empty list', async () => {
  mock(() => Promise.reject(new TypeError('offline')));
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Ergebnisse abrufen' }));
  expect((await screen.findByRole('alert')).textContent).toContain('nicht geladen');
  expect(screen.queryByText('Keine Releases gefunden.')).toBeNull();
});

test('late response does not overwrite newer query', async () => {
  const resolvers: ((r: Response) => void)[] = [];
  mock(() => new Promise<Response>((res) => resolvers.push(res)));
  render(<App />);
  const user = userEvent.setup();
  const btn = screen.getByRole('button', { name: 'Ergebnisse abrufen' });
  await user.click(btn);
  await user.click(btn);
  resolvers[1]?.(new Response(JSON.stringify({ releases: [] })));
  expect(await screen.findByText('Keine Releases gefunden.')).toBeTruthy();
  resolvers[0]?.(new Response(JSON.stringify({ releases: [rel] })));
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.queryByText('Dune')).toBeNull();
});
