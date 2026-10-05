import { supabase } from "../lib/supabase.js";

function mapProduct(row) {
  return {
    id: row.id,
    type: row.type,
    sectionId: row.section_id,
    badge: row.badge,
    title: row.title,
    description: row.description,
    specs: row.specs ?? [],
    images: row.images ?? [],
    variants: row.variants ?? [],
    saveTag: row.save_tag,
    price: row.price,
    oldPrice: row.old_price,
    defaultWhatsappMsg: row.default_whatsapp_msg,
  };
}

function mapSettings(row) {
  return {
    brandTitle: row.brand_title,
    tagline: row.tagline,
    logoUrl: row.logo_url ?? "",
    faviconUrl: row.favicon_url ?? "",
    colorPalette: row.color_palette ?? null,
    loadingScreen: row.loading_screen ?? null,
    adminBrand: row.admin_brand ?? null,
    heroPills: row.hero_pills ?? [],
    contact: {
      whatsappNumber: row.whatsapp_number,
      phoneDisplay: row.phone_display,
      email: row.email,
      location: row.location,
    },
    features: row.features ?? [],
    footerTitle: row.footer_title,
    footerCopyright: row.footer_copyright,
    footerDisclaimer: row.footer_disclaimer,
    comingSoonTitle: row.coming_soon_title,
    visibility: row.visibility ?? {},
  };
}

export async function getCatalog(onSettingsLoaded) {
  if (!supabase) {
    return {
      products: [],
      sections: [],
      settings: null,
      error: new Error("Supabase is not configured."),
    };
  }

  const settingsRequest = supabase
    .from("site_settings")
    .select("logo_url, favicon_url, color_palette, loading_screen, admin_brand, hero_pills, brand_title, tagline, whatsapp_number, phone_display, email, location, features, footer_title, footer_copyright, footer_disclaimer, coming_soon_title, visibility")
    .eq("id", "storefront")
    .maybeSingle();
  const settingsPromise = settingsRequest.then((result) => {
    if (!result.error && result.data) onSettingsLoaded?.(mapSettings(result.data));
    return result;
  });
  const [productsResult, sectionsResult, settingsResult] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("catalog_sections")
      .select("id, title, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    settingsPromise,
  ]);

  if (productsResult.error || sectionsResult.error || settingsResult.error) {
    return {
      products: [],
      sections: [],
      settings: null,
      error: productsResult.error || sectionsResult.error || settingsResult.error,
    };
  }

  const row = settingsResult.data;
  if (!row) {
    return {
      products: productsResult.data.map(mapProduct),
      sections: sectionsResult.data,
      settings: null,
      error: new Error("Storefront settings are missing from Supabase."),
    };
  }

  return {
    products: productsResult.data.map(mapProduct),
    sections: sectionsResult.data,
    settings: mapSettings(row),
    error: null,
  };
}