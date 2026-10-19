export default function AboutPage({ content }) {
  return (
    <article className="about-page">
      <div className="about-page-heading">
        <p className="about-page-eyebrow">A LITTLE ABOUT US</p>
        <h2>{content.title}</h2>
        <p className="about-page-introduction">{content.introduction}</p>
      </div>
      <div className="about-page-values">
        <section className="about-value-card about-mission">
          <span className="about-value-number" aria-hidden="true">01</span>
          <h3>Our mission</h3>
          <p>{content.mission}</p>
        </section>
        <section className="about-value-card about-vision">
          <span className="about-value-number" aria-hidden="true">02</span>
          <h3>Our vision</h3>
          <p>{content.vision}</p>
        </section>
      </div>
      <section className="about-who-card">
        <div>
          <p className="about-page-eyebrow">THE PEOPLE BEHIND THE CARE</p>
          <h3>Who we are</h3>
        </div>
        <p>{content.whoWeAre}</p>
        <a href="#site-footer" className="about-contact-link">Talk with our team <span aria-hidden="true">→</span></a>
      </section>
      <a className="about-back-link" href="#top">Explore the store</a>
    </article>
  );
}
