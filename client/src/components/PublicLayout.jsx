import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import Icon from './Icon.jsx';
import useFavorites from '../hooks/useFavorites.js';
import useAuth from '../hooks/useAuth.jsx';
import { catalogSearch, readCatalogFilters } from '../lib/catalog.js';

export default function PublicLayout() {
  const location = useLocation();
  const { pathname, search, hash } = location;
  const navigationType = useNavigationType();
  const previousLocation = useRef(null);
  const favorites = useFavorites();
  const { user } = useAuth();
  const home = `/${catalogSearch(readCatalogFilters(new URLSearchParams(search)))}`;

  useEffect(() => {
    const previous = previousLocation.current;
    previousLocation.current = location;
    // Filter changes replace the URL without moving the visitor away from the controls.
    if (navigationType === 'REPLACE' && previous?.pathname === pathname && previous.hash === hash && previous.search !== search) return;
    const targets = { '#pradzia': 'hero-title', '#gyvunai': 'catalog-title', '#apie-mus': 'about-title' };
    const target = document.getElementById(targets[hash] || 'turinys');
    target?.scrollIntoView({ block: 'start' });
    if (targets[hash]) target?.focus({ preventScroll: true });
  }, [location, navigationType, pathname, search, hash]);

  return (
    <>
      <a className="skip-link" href="#turinys">Pereiti prie turinio</a>
      <header className="site-header" id="pradzia">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label="Gyvūnų prieglauda – pradžia">
            <img className="brand-icon" src="/favicon.svg" alt="" /><span>Gyvūnų prieglauda</span>
          </Link>
          <nav className="main-nav" aria-label="Pagrindinis meniu">
            <Link to={`${home}#pradzia`}>Pradžia</Link>
            <Link to={`${home}#gyvunai`} aria-current={pathname.startsWith('/gyvunai/') ? 'page' : undefined}>Gyvūnai</Link>
            <Link to={`${home}#apie-mus`}>Apie mus</Link>
          </nav>
          <Link className="button header-cta" to="/prisijungti">{user ? 'Mano paskyra' : 'Prisijungti'} <Icon name="user" size={17} /></Link>
        </div>
      </header>
      <main id="turinys" tabIndex="-1"><Outlet context={favorites} /></main>
      <p className="sr-only" role="status">{favorites.notice}</p>
      <footer className="site-footer"><div className="container footer-inner">
        <Link className="brand footer-brand" to="/"><img src="/favicon.svg" alt="" /><span>Gyvūnų prieglauda</span></Link>
        <p>Kartu kuriame laimingas istorijas.</p>
        <Link className="back-top" to={`${home}#pradzia`}>Į pradžią <span aria-hidden="true">↑</span></Link>
      </div></footer>
    </>
  );
}
