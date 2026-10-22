export default function CatalogLoading({ content }) {
  return (
    <section className="catalog-loading" role="status" aria-busy="true" aria-labelledby="catalog-loading-title">
      <div className="catalog-loading-feature">
        <img src={content.imageUrl} alt="" />
        <div className="catalog-loading-copy">
          <p className="catalog-loading-kicker">{content.kicker}</p>
          <h2 id="catalog-loading-title">{content.title}</h2>
          <p>{content.message}</p>
          <div className="catalog-loading-progress" role="progressbar" aria-label="Loading products"><span /></div>
        </div>
      </div>
      <div className="catalog-loading-skeletons" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div className="catalog-loading-card" key={item}>
            <span />
            <i />
            <b />
            <b />
          </div>
        ))}
      </div>
    </section>
  );
}