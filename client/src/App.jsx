function Paw({ className = '' }) {
  return <img className={className} src="/favicon.svg" alt="" aria-hidden="true" />;
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#turinys">Pereiti prie turinio</a>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#pradzia" aria-label="Gyvūnų prieglauda – pradžia">
            <Paw className="brand-icon" />
            <span>Gyvūnų prieglauda</span>
          </a>
          <nav aria-label="Pagrindinis meniu">
            <a href="#pradzia">Pradžia</a>
            <a href="#apie-mus">Apie mus</a>
          </nav>
        </div>
      </header>

      <main id="turinys">
        <section className="hero" id="pradzia" aria-labelledby="hero-title">
          <div className="container hero-inner">
            <div className="hero-copy">
              <span className="eyebrow">Maža pagalba. Didelis pokytis.</span>
              <h1 id="hero-title">Padėkime jiems<br />rasti <span>namus.</span></h1>
              <p>Prieglaudoje gyvena nuostabūs gyvūnai, laukiantys savo šeimos. Kartu galime suteikti jiems geresnį gyvenimą.</p>
              <a className="button" href="#apie-mus">Susipažinkite su mumis <span aria-hidden="true">↗</span></a>
            </div>
            <div className="hero-mark" aria-hidden="true">
              <div className="paw-circle"><Paw /></div>
              <span>Kiekvienas nusipelno meilės.</span>
            </div>
          </div>
        </section>

        <section className="container about-section" id="apie-mus" aria-labelledby="about-title">
          <div>
            <span className="eyebrow">Apie mus</span>
            <h2 id="about-title">Kol atsiras namai,<br />esame šalia.</h2>
          </div>
          <div className="about-copy">
            <p>Rūpinamės gyvūnais, kuriems reikia saugumo, priežiūros ir žmogaus artumo. Tikime, kad kiekvienas iš jų nusipelno atsakingos, mylinčios šeimos.</p>
            <p>Priglausti gyvūną – ilgalaikis įsipareigojimas. Svarbu įvertinti jo poreikius ir skirti laiko pažinčiai.</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span>Gyvūnų prieglauda</span>
          <span>Kartu kuriame laimingas istorijas.</span>
        </div>
      </footer>
    </>
  );
}
