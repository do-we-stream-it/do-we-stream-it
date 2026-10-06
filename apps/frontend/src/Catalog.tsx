import { useEffect, useRef, useState } from 'react';
import { CATALOG, PROVIDERS, type ProviderId } from './mock';

type TypeFilter = 'all' | 'movie' | 'series';

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

function Card({ item, index }: { item: (typeof CATALOG)[number]; index: number }) {
  const [ref, seen] = useReveal<HTMLLIElement>();
  const p = PROVIDERS[item.provider];
  return (
    <li ref={ref} className={`card${seen ? ' in' : ''}`} style={{ transitionDelay: `${(index % 4) * 70}ms` }}>
      <div className="poster">
        <img src={item.poster} alt={`Poster: ${item.title}`} loading="lazy" width="400" height="600" />
        <span className="badge" style={{ background: p.color }}>{p.name}</span>
        <span className="rating">★ {item.rating.toFixed(1)}</span>
        <div className="overlay"><p>{item.description}</p></div>
      </div>
      <h3>{item.title}</h3>
      <p className="muted">{item.type === 'movie' ? 'Film' : 'Serie'} · {item.genre} · {item.year}</p>
    </li>
  );
}

export function Catalog() {
  const [provider, setProvider] = useState<ProviderId | 'all'>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const items = CATALOG.filter((i) => (provider === 'all' || i.provider === provider) && (type === 'all' || i.type === type));

  return (
    <section aria-labelledby="catalog-title">
      <h2 id="catalog-title" className="section-title">Katalog <span className="muted">· {items.length} Titel</span></h2>
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
          {items.map((item, i) => <Card key={item.id} item={item} index={i} />)}
        </ul>
      )}
    </section>
  );
}
