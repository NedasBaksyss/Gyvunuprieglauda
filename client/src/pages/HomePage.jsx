import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import AnimalCard from '../components/AnimalCard.jsx';
import useJson from '../hooks/useJson.js';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import usePageHeading from '../hooks/usePageHeading.js';
import { catalogUrl, statusLabels, readCatalogFilters, catalogSearch } from '../lib/catalog.js';

const emptyFilters = { q: '', speciesId: '', status: '', page: 1 };

export default function HomePage() {
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const filters = readCatalogFilters(new URLSearchParams(search));
  const pageHeading = usePageHeading();
  const [draftQuery, setDraftQuery] = useState(filters.q);
  const [heroSpecies, setHeroSpecies] = useState(filters.speciesId);
  useEffect(() => { setDraftQuery(filters.q); }, [filters.q]);
  useEffect(() => { setHeroSpecies(filters.speciesId); }, [filters.speciesId]);
  const catalogHeading = useRef(null);
  const species = useJson('/api/species');
  const catalog = useJson(catalogUrl(filters));
  const { favorites, toggle } = useOutletContext();
  const speciesItems = species.data?.items || [];
  const pagination = catalog.data?.pagination;
  const emptyPage = pagination?.page > 1 && catalog.data?.items.length === 0;
  const hasFilters = Boolean(filters.q || filters.speciesId || filters.status);

  function setFilters(value) {
    const next = typeof value === 'function' ? value(filters) : value;
    navigate({ search: catalogSearch(next), hash }, { replace: true });
  }

  function focusCatalog() {
    catalogHeading.current?.focus({ preventScroll: true });
    catalogHeading.current?.scrollIntoView({ block: 'start' });
  }

  function filterBy(name, value) {
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));
    if (name === 'speciesId') setHeroSpecies(value);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setDraftQuery('');
    setHeroSpecies('');
  }

  function searchFromHero(event) {
    event.preventDefault();
    setFilters({ ...emptyFilters, speciesId: heroSpecies });
    setDraftQuery('');
    focusCatalog();
  }

  return (
    <>
      <section className="container hero" aria-labelledby="hero-title">
        <div className="hero-pictures" aria-hidden="true">
          <img className="hero-dog" src="/images/animals/lukas.webp" alt="" fetchPriority="high" />
          <img className="hero-cat" src="/images/animals/pukas.webp" alt="" />
        </div>
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow"><span />Čia prasideda draugystė</span>
          <h1 id="hero-title" ref={pageHeading} tabIndex="-1">Padėkime jiems<br />rasti namus.</h1>
          <p>Prieglaudoje gyvena nuostabūs gyvūnai,<br className="desktop-break" /> laukiantys savo šeimos. Galbūt tavosios?</p>
          <form className="hero-search" onSubmit={searchFromHero} aria-label="Rasti gyvūną pagal rūšį">
            <label className="sr-only" htmlFor="hero-species">Gyvūno rūšis</label>
            <select id="hero-species" value={heroSpecies} onChange={(event) => setHeroSpecies(event.target.value)} disabled={species.loading || Boolean(species.error)}>
              <option value="">Visos rūšys</option>
              {speciesItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <button className="button" type="submit"><Icon name="search" size={18} />Ieškoti</button>
          </form>
          <div className="hero-note"><Icon name="heart" size={16} /><span>Maža pagalba. Visas jų pasaulis.</span></div>
        </div>
      </section>

      <section className="container catalog-section" id="gyvunai" aria-labelledby="catalog-title">
        <div className="section-heading">
          <div><span className="eyebrow">Susipažinkime</span><h2 id="catalog-title" ref={catalogHeading} tabIndex="-1">Mūsų gyvūnai</h2></div>
          <p>Kiekvienas jų turi istoriją.<br />Padėk parašyti laimingą tęsinį.</p>
        </div>

        <div className="catalog-toolbar">
          <form className="name-search" role="search" onSubmit={(event) => { event.preventDefault(); filterBy('q', draftQuery.trim()); }}>
            <Icon name="search" size={19} />
            <label className="sr-only" htmlFor="animal-search">Ieškoti pagal vardą</label>
            <input id="animal-search" type="search" maxLength="100" placeholder="Ieškoti pagal vardą…"
              value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} />
            <button type="submit">Ieškoti</button>
          </form>
          <div className="select-filter">
            <label htmlFor="catalog-species">Rūšis</label>
            <select id="catalog-species" value={filters.speciesId} onChange={(event) => filterBy('speciesId', event.target.value)} disabled={species.loading || Boolean(species.error)}>
              <option value="">Visos rūšys</option>
              {speciesItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="select-filter">
            <label htmlFor="catalog-status">Būsena</label>
            <select id="catalog-status" value={filters.status} onChange={(event) => filterBy('status', event.target.value)}>
              <option value="">Visos būsenos</option>
              {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
        </div>

        {species.error && <div className="inline-error" role="alert">Rūšių filtro nepavyko įkelti. <button type="button" onClick={species.retry}>Bandyti dar kartą</button></div>}
        <div className="catalog-summary">
          <p role="status">{catalog.loading ? 'Ieškome draugų…' : catalog.error ? 'Sąrašo nepavyko įkelti' : <>Rasta gyvūnų: <strong>{pagination.total}</strong></>}
            {filters.q && <span className="search-term"> pagal „{filters.q}“</span>}</p>
          {hasFilters && <button type="button" className="clear-filters" onClick={resetFilters}><Icon name="close" size={14} />Išvalyti filtrus</button>}
        </div>

        <div aria-busy={catalog.loading}>
          {catalog.loading ? <div className="animal-grid skeleton-grid" aria-hidden="true">{[0, 1, 2, 3].map((id) => <div className="skeleton-card" key={id}><div /><span /><span /></div>)}</div>
            : catalog.error ? <div className="empty-state" role="alert"><img src="/favicon.svg" alt="" /><h3>Nepavyko įkelti gyvūnų</h3><p>{catalog.error}</p><button className="button" onClick={catalog.retry}>Bandyti dar kartą</button></div>
              : catalog.data.items.length === 0 ? <div className="empty-state"><img src="/favicon.svg" alt="" />
                <h3>{emptyPage ? 'Šiame puslapyje gyvūnų nebėra' : hasFilters ? 'Tokio draugo kol kas neradome' : 'Gyvūnų sąrašas kol kas tuščias'}</h3>
                <p>{emptyPage ? 'Sąrašas pasikeitė. Grįžkite į pirmą puslapį.' : hasFilters ? 'Pabandykite kitą vardą, rūšį arba būseną.' : 'Užsukite vėliau susipažinti su mūsų globotiniais.'}</p>
                {emptyPage ? <button className="button" onClick={() => setFilters((current) => ({ ...current, page: 1 }))}>Grįžti į pirmą puslapį</button>
                  : hasFilters && <button className="button" onClick={resetFilters}>Rodyti visus gyvūnus</button>}</div>
                : <div className="animal-grid">{catalog.data.items.map((animal) => <AnimalCard key={animal.id} animal={animal} catalogSearch={catalogSearch(filters)} favorite={favorites.has(animal.id)} onToggleFavorite={toggle} />)}</div>}
        </div>

        {pagination?.totalPages > 1 && <nav className="pagination" aria-label="Gyvūnų sąrašo puslapiai">
          <button type="button" className="page-button" disabled={filters.page === 1} onClick={() => { setFilters((current) => ({ ...current, page: current.page - 1 })); focusCatalog(); }}><Icon name="chevron" className="flip-icon" size={16} />Ankstesnis</button>
          <span>Puslapis <strong>{pagination.page}</strong> iš {pagination.totalPages}</span>
          <button type="button" className="page-button" disabled={filters.page >= pagination.totalPages} onClick={() => { setFilters((current) => ({ ...current, page: current.page + 1 })); focusCatalog(); }}>Kitas<Icon name="chevron" size={16} /></button>
        </nav>}
      </section>

      <section className="about-wrap" id="apie-mus" aria-labelledby="about-title">
        <div className="container about-section">
          <div className="about-heading"><span className="eyebrow">Apie mus</span><h2 id="about-title" tabIndex="-1">Kol atsiras namai,<br />esame šalia.</h2><img className="about-paw" src="/favicon.svg" alt="" /></div>
          <div className="about-copy"><p>Rūpinamės gyvūnais, kuriems reikia saugumo, priežiūros ir žmogaus artumo. Tikime, kad kiekvienas jų nusipelno atsakingos, mylinčios šeimos.</p>
            <div className="adoption-note"><Icon name="shield" size={24} /><p><strong>Draugystė – visam gyvenimui.</strong> Priglausti gyvūną yra ilgalaikis įsipareigojimas. Įvertinkite jo poreikius ir skirkite laiko pažinčiai.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
