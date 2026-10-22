import { useEffect, useRef, useState } from "react";

const placeholderImage = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' fill='%2394a3b8' font-family='sans-serif' font-size='16' text-anchor='middle' dy='.3em'%3ENo Image%3E%3C/svg%3E";

function handleImageError(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = placeholderImage;
}

export default function ProductGallery({ product }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const touchStartX = useRef(null);
  const zoomDialogRef = useRef(null);
  const zoomCloseRef = useRef(null);
  const images = product.images?.length ? product.images : [placeholderImage];
  const activeImage = images[activeIndex] ?? images[0];
  const changeImage = (direction) => {
    setActiveIndex((index) => (index + direction + images.length) % images.length);
  };
  const handleTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 45) changeImage(delta < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  useEffect(() => {
    if (!isZoomed) return undefined;
    const previouslyFocused = document.activeElement;
    zoomCloseRef.current?.focus();
    function handleZoomKeys(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setIsZoomed(false);
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = zoomDialogRef.current?.querySelectorAll('button:not(:disabled):not([tabindex="-1"])');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleZoomKeys, true);
    return () => {
      document.removeEventListener("keydown", handleZoomKeys, true);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [isZoomed]);

  return (
    <div className="card-gallery">
      <div
        className="carousel-images"
        onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
        onTouchEnd={handleTouchEnd}
      >
        <button
          className="product-gallery-zoom-trigger"
          type="button"
          onClick={() => setIsZoomed(true)}
          aria-label={`Enlarge ${product.title} photo ${activeIndex + 1}`}
        >
          <img
            key={`${activeImage}-${activeIndex}`}
            src={activeImage}
            alt={`${product.title} photo ${activeIndex + 1} of ${images.length}`}
            className="card-main-image active"
            width="800"
            height="600"
            loading="eager"
            decoding="async"
            onError={handleImageError}
          />
        </button>
        {images.length > 1 && (
          <>
            <button className="carousel-btn prev" type="button" onClick={() => changeImage(-1)} aria-label="Previous photo">&#10094;</button>
            <button className="carousel-btn next" type="button" onClick={() => changeImage(1)} aria-label="Next photo">&#10095;</button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="product-gallery-thumbnails" role="group" aria-label={`Product photos, ${activeIndex + 1} of ${images.length}`}>
          {images.map((image, index) => (
            <button
              key={`${image}-thumb-${index}`}
              className={`product-gallery-thumbnail${index === activeIndex ? " is-active" : ""}`}
              type="button"
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={index === activeIndex}
              onClick={() => setActiveIndex(index)}
            >
              <img src={image} alt="" loading="lazy" width="64" height="64" onError={handleImageError} />
            </button>
          ))}
        </div>
      )}
      {isZoomed && (
        <div className="product-image-zoom" role="dialog" aria-modal="true" aria-label={`${product.title} enlarged photo`} ref={zoomDialogRef}>
          <button className="product-image-zoom-backdrop" type="button" onClick={() => setIsZoomed(false)} aria-label="Close enlarged image" tabIndex="-1" />
          <button className="product-image-zoom-close" type="button" onClick={() => setIsZoomed(false)} aria-label="Close enlarged image" ref={zoomCloseRef}>×</button>
          <img src={activeImage} alt={`${product.title} photo ${activeIndex + 1} of ${images.length}`} />
          {images.length > 1 && (
            <>
              <button className="product-image-zoom-prev" type="button" onClick={() => changeImage(-1)} aria-label="Previous photo">‹</button>
              <button className="product-image-zoom-next" type="button" onClick={() => changeImage(1)} aria-label="Next photo">›</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
