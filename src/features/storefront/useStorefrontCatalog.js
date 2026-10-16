import { useEffect, useState } from "react";
import { getCatalog } from "../../services/catalog.js";

export default function useStorefrontCatalog() {
  const [catalog, setCatalog] = useState({
    products: [],
    sections: [],
    mainSections: [],
    settings: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    getCatalog((settings) => {
      if (active) setCatalog((current) => ({ ...current, settings }));
    }).then((result) => {
      if (!active) return;
      setCatalog({ ...result, loading: false });
    }).catch((error) => {
      if (!active) return;
      setCatalog({ products: [], sections: [], mainSections: [], settings: null, loading: false, error });
    });
    return () => { active = false; };
  }, []);

  return catalog;
}