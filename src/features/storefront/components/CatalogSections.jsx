import ProductCard from "./ProductCard.jsx";

function renderSubsection(section, products, whatsappNumber, onAddToCart, nested = false) {
  const sectionProducts = products.filter((product) => product.sectionId === section.id);
  if (!sectionProducts.length) return null;

  return (
    <section key={section.id} aria-labelledby={`catalog-section-${section.id}`}>
      {nested
        ? <h3 className="catalog-subsection-title" id={`catalog-section-${section.id}`}>{section.title}</h3>
        : <h2 className="section-title" id={`catalog-section-${section.id}`}>{section.title}</h2>}
      <div className="grid">
        {sectionProducts.map((product) => <ProductCard key={product.id} product={product} whatsappNumber={whatsappNumber} onAddToCart={onAddToCart} />)}
      </div>
    </section>
  );
}

export default function CatalogSections({ mainSections, sections, products, whatsappNumber, onAddToCart }) {
  const groupedSections = mainSections.map((mainSection) => ({
    mainSection,
    sections: sections.filter((section) => section.main_section_id === mainSection.id),
  }));
  const groupedSectionIds = new Set(groupedSections.flatMap((group) => group.sections.map((section) => section.id)));
  const standaloneSections = sections.filter((section) => !groupedSectionIds.has(section.id));

  return (
    <>
      {groupedSections.map(({ mainSection, sections: childSections }) => {
        const hasProducts = childSections.some((section) => products.some((product) => product.sectionId === section.id));
        if (!hasProducts) return null;

        return (
          <section key={mainSection.id} aria-labelledby={`catalog-main-section-${mainSection.id}`}>
            <h2 className="section-title" id={`catalog-main-section-${mainSection.id}`}>{mainSection.title}</h2>
            {childSections.map((section) => renderSubsection(section, products, whatsappNumber, onAddToCart, true))}
          </section>
        );
      })}
      {standaloneSections.map((section) => renderSubsection(section, products, whatsappNumber, onAddToCart))}
    </>
  );
}