export default function CategoryNav({
  mainSections,
  sections,
  selectedMainId,
  selectedSectionId,
  onSelectAll,
  onSelectMain,
  onSelectSection,
}) {
  const visibleSections = sections.filter((section) => section.main_section_id === selectedMainId);

  return (
    <nav className="category-nav" aria-label="Shop categories">
      <div className="category-chip-row" aria-label="Main categories">
        <button type="button" className="category-chip" aria-pressed={!selectedMainId && !selectedSectionId} onClick={onSelectAll}>
          All products
        </button>
        {mainSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className="category-chip"
            aria-pressed={selectedMainId === section.id && !selectedSectionId}
            onClick={() => onSelectMain(section.id)}
          >
            {section.title}
          </button>
        ))}
        {sections.filter((section) => !section.main_section_id).map((section) => (
          <button
            key={section.id}
            type="button"
            className="category-chip"
            aria-pressed={selectedSectionId === section.id}
            onClick={() => onSelectSection(section.id)}
          >
            {section.title}
          </button>
        ))}
      </div>
      {visibleSections.length > 0 && (
        <div className="category-chip-row category-chip-row-sub" aria-label="Sub-categories">
          {visibleSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className="category-chip category-chip-sub"
              aria-pressed={selectedSectionId === section.id}
              onClick={() => onSelectSection(section.id)}
            >
              {section.title}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
