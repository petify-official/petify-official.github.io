import { useEffect, useState } from "react";

export default function useScrollAwareVisibility({ threshold = 5, topOffset = 80 } = {}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let previousY = window.scrollY;
    let animationFrame = 0;

    function handleScroll() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const movement = currentY - previousY;
        if (currentY <= topOffset || movement < -threshold) {
          setVisible(true);
        } else if (movement > threshold) {
          setVisible(false);
        }
        previousY = currentY;
        animationFrame = 0;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [threshold, topOffset]);

  return visible;
}
