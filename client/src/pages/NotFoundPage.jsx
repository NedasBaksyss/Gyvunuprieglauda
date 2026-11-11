import { Link } from 'react-router-dom';
import usePageHeading from '../hooks/usePageHeading.js';

export default function NotFoundPage({ animal = false, catalogHref = '/#gyvunai' }) {
  const title = animal ? 'Gyvūnas nerastas' : 'Puslapis nerastas';
  const heading = usePageHeading(title);
  return (
    <section className="container page-state">
      <div className="empty-state">
        <img src="/favicon.svg" alt="" /><span className="eyebrow">404</span>
        <h1 className="state-title" ref={heading} tabIndex="-1">{title}</h1>
        <p>{animal ? 'Šio gyvūno įrašo nebėra arba nuoroda neteisinga. Kataloge galite susipažinti su kitais globotiniais.' : 'Toks adresas neegzistuoja. Grįžkite susipažinti su mūsų gyvūnais.'}</p>
        <Link className="button" to={catalogHref}>Grįžti į gyvūnų sąrašą</Link>
      </div>
    </section>
  );
}
