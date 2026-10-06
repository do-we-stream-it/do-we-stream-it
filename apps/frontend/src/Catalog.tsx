import { useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG, PROVIDERS, type CatalogItem, type ProviderId } from './mock';

type TypeFilter = 'all' | 'movie' | 'series';
type Sort = 'featured' | 'rating' | 'year' | 'title';

const SORTS: Record<Sort, (a: CatalogItem, b: CatalogItem) => number> = {
  featured: () => 0,
  rating: (a, b) => b.rating - a.rating,
  year: (a, b) => b.year - a.year,
  title: (a, b) => a.title.localeCompare(b.title, 'de'),
};

const TOP = [...CATALOG].sort(SORTS.rating);

// Adds .in once the element scrolls into view; no IO support → just show it.
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

function useWatchlist() {
  const [ids, setIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('watchlist') ?? '[]') as string[]; } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('watchlist', JSON.stringify(ids)); } catch { /* private mode */ }
  }, [ids]);
  const toggle = (id: string) => setIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  return [ids, toggle] as const;
}

interface Actions { open: (i: CatalogItem) => void; fav: string[]; toggle: (id: string) => void }

function Heart({ item, fav, toggle }: { item: CatalogItem } & Pick<Actions, 'fav' | 'toggle'>) {
  const on = fav.includes(item.id);
  return (
    <button type="button" className="heart" aria-pressed={on} aria-label={`${item.title} ${on ? 'von Merkliste entfernen' : 'zur Merkliste'}`} onClick={() => toggle(item.id)}>
      {on ? '♥' : '♡'}
    </button>
  );
}

function Card({ item, index, a }: { item: CatalogItem; index: number; a: Actions }) {
  const [ref, seen] = useReveal<HTMLLIElement>();
  const p = PROVIDERS[item.provider];
  return (
    <li ref={ref} className={`card${seen ? ' in' : ''}`} style={{ transitionDelay: `${(index % 4) * 70}ms` }}>
      <div className="poster">
        <button type="button" className="poster-btn" onClick={() => a.open(item)} aria-label={`Details zu ${item.title}`}>
          <img src={item.poster} alt={`Poster: ${item.title}`} loading="lazy" width="400" height="600" />
        </button>
        <span className="badge" style={{ background: p.color }}>{p.name}</span>
        <span className="rating">★ {item.rating.toFixed(1)}</span>
        <Heart item={item} fav={a.fav} toggle={a.toggle} />
        <div className="overlay"><p>{item.description}</p></div>
      </div>
      <h3>{item.title}</h3>
      <p className="muted">{item.type === 'movie' ? 'Film' : 'Serie'} · {item.genre} · {item.year}</p>
    </li>
  );
}

function Spotlight({ item, a }: { item: CatalogItem; a: Actions }) {
  const p = PROVIDERS[item.provider];
  return (
    <section className="spotlight" aria-label="Highlight">
      <img className="spot-img" src={item.poster} alt="" />
      <div className="spot-copy">
        <span className="badge" style={{ background: p.color }}>Jetzt auf {p.name}</span>
        <h2>{item.title}</h2>
        <p className="muted">★ {item.rating.toFixed(1)} · {item.genre} · {item.year}</p>
        <p>{item.description}</p>
        <button type="button" className="primary" onClick={() => a.open(item)}>Details ansehen</button>
      </div>
    </section>
  );
}

function Trending({ a }: { a: Actions }) {
  return (
    <section aria-labelledby="trend-title">
      <h2 id="trend-title" className="section-title">Top 10 diese Woche</h2>
      <ol className="trend">
        {TOP.slice(0, 10).map((item, i) => (
          <li key={item.id}>
            <span className="rank" aria-hidden="true">{i + 1}</span>
            <button type="button" onClick={() => a.open(item)} aria-label={`Platz ${i + 1}: ${item.title}`}>
              <img src={item.poster} alt="" loading="lazy" width="400" height="600" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Detail({ item, a, onClose }: { item: CatalogItem | null; a: Actions; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (item && !d.open) d.showModal?.();
    if (!item && d.open) d.close?.();
  }, [item]);
  const p = item && PROVIDERS[item.provider];
  return (
    <dialog ref={ref} className="detail" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={item?.title}>
      {item && p && (
        <div className="detail-body">
          <img src={item.poster} alt={`Poster: ${item.title}`} />
          <div>
            <span className="badge" style={{ background: p.color }}>{p.name}</span>
            <h2>{item.title}</h2>
            <p className="muted">{item.type === 'movie' ? 'Film' : 'Serie'} · {item.genre} · {item.year} · ★ {item.rating.toFixed(1)}</p>
            <p>{item.description}</p>
            <p className="answer">Ja, du kannst es streamen: <strong>{p.name}</strong></p>
            <div className="actions">
              <button type="button" className="primary" onClick={() => a.toggle(item.id)}>
                {a.fav.includes(item.id) ? '♥ Auf der Merkliste' : '♡ Merken'}
              </button>
              <button type="button" className="secondary" onClick={onClose}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

export function Catalog() {
  const [provider, setProvider] = useState<ProviderId | 'all'>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<Sort>('featured');
  const [q, setQ] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [fav, toggle] = useWatchlist();
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const a: Actions = { open: setSelected, fav, toggle };

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOG.filter((i) =>
      (provider === 'all' || i.provider === provider) &&
      (type === 'all' || i.type === type) &&
      (!onlyFav || fav.includes(i.id)) &&
      (!needle || `${i.title} ${i.genre}`.toLowerCase().includes(needle)),
    ).sort(SORTS[sort]);
  }, [provider, type, sort, q, onlyFav, fav]);

  return (
    <>
      {TOP[0] && <Spotlight item={TOP[0]} a={a} />}
      <Trending a={a} />
      <section aria-labelledby="catalog-title">
        <h2 id="catalog-title" className="section-title">Katalog <span className="muted">· {items.length} Titel</span></h2>
        <div className="toolbar">
          <input type="search" className="search" placeholder="Titel oder Genre suchen …" aria-label="Katalog durchsuchen" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Sortierung" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="featured">Empfohlen</option>
            <option value="rating">Beste Bewertung</option>
            <option value="year">Neueste zuerst</option>
            <option value="title">A–Z</option>
          </select>
          <button type="button" className="chip" aria-pressed={onlyFav} onClick={() => setOnlyFav((v) => !v)}>♥ Merkliste ({fav.length})</button>
        </div>
        <div className="filters" role="group" aria-label="Filter">
          {(['all', ...Object.keys(PROVIDERS)] as const).map((id) => (
            <button key={id} type="button" className="chip" aria-pressed={provider === id} onClick={() => setProvider(id as ProviderId | 'all')}>
              {id === 'all' ? 'Alle Anbieter' : PROVIDERS[id as ProviderId].name}
            </button>
          ))}
          <span className="sep" aria-hidden="true" />
          {([['all', 'Alles'], ['movie', 'Filme'], ['series', 'Serien']] as const).map(([id, label]) => (
            <button key={id} type="button" className="chip" aria-pressed={type === id} onClick={() => setType(id)}>{label}</button>
          ))}
        </div>
        {items.length === 0 ? (
          <p className="muted">Nichts gefunden – andere Filter probieren.</p>
        ) : (
          <ul className="grid">
            {items.map((item, i) => <Card key={item.id} item={item} index={i} a={a} />)}
          </ul>
        )}
      </section>
      <Detail item={selected} a={a} onClose={() => setSelected(null)} />
    </>
  );
}
