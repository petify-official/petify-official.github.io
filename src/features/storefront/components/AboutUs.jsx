const focusAreas = [
  {
    number: "01",
    title: "Animals, thoughtfully considered",
    description: "Discover fascinating aquatic life and exotic companions, with care and informed keeping at the heart of every choice.",
    tone: "ocean",
  },
  {
    number: "02",
    title: "The essentials for better care",
    description: "Find species-focused nutrition and habitats designed to help keepers create comfortable, enriching environments.",
    tone: "leaf",
  },
  {
    number: "03",
    title: "A more connected keeper journey",
    description: "We are building toward practical species matching, habitat planning, and care tools that make everyday keeping easier.",
    tone: "sun",
  },
];

export default function AboutUs() {
  return (
    <>
      <header className="about-header">
        <a className="about-wordmark" href="#top" aria-label="Petify home">petify<span>.</span></a>
        <nav className="about-nav" aria-label="Main navigation">
          <a href="#top">Shop</a>
          <a href="#about" aria-current="page">About us</a>
        </nav>
      </header>
      <main className="about-page" id="top">
        <section className="about-hero" aria-labelledby="about-title">
          <p className="about-eyebrow"><span aria-hidden="true" /> A little closer to nature</p>
          <h1 id="about-title">Better care starts with a <span>deeper connection.</span></h1>
          <p className="about-intro">
            Petify is a growing home for curious keepers and the extraordinary animals they care for.
            We bring together thoughtful animal discovery, dependable care essentials, and ideas for
            creating habitats where life can thrive.
          </p>
          <a className="about-cta" href="#top" onClick={(event) => {
            event.preventDefault();
            window.location.hash = "top";
          }}>
            Explore the store <span aria-hidden="true">→</span>
          </a>
          <div className="about-orbit about-orbit-one" aria-hidden="true" />
          <div className="about-orbit about-orbit-two" aria-hidden="true" />
        </section>

        <section className="about-focus" aria-labelledby="about-focus-title">
          <div className="about-section-heading">
            <p className="about-eyebrow">What we are building</p>
            <h2 id="about-focus-title">A more complete world for pets and their people.</h2>
          </div>
          <div className="about-focus-grid">
            {focusAreas.map((area) => (
              <article className={`about-focus-card about-focus-${area.tone}`} key={area.number}>
                <span className="about-focus-number">{area.number}</span>
                <h3>{area.title}</h3>
                <p>{area.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-coming-soon" aria-labelledby="about-coming-title">
          <div>
            <p className="about-eyebrow">Growing with you</p>
            <h2 id="about-coming-title">Care tools for what comes next.</h2>
            <p>
              Smart habitat accessories and helpful digital tools are part of our roadmap.
              We will keep upcoming ideas clearly marked, so you always know what is available now.
            </p>
          </div>
          <a className="about-cta about-cta-light" href="#top" onClick={(event) => {
            event.preventDefault();
            window.location.hash = "top";
          }}>
            Meet Petify <span aria-hidden="true">→</span>
          </a>
        </section>
      </main>
    </>
  );
}
