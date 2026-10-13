import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { formatProductPrice } from "../../lib/productPricing.js";
import WorkspaceSidebar from "./WorkspaceSidebar.jsx";
import { createAdminNavigationItems } from "./adminNavigation.js";
import AccountMenu from "./AccountMenu.jsx";
import { deleteWorkspaceDraft, getWorkspaceDrafts } from "../../services/workspaceDrafts.js";
import { clearSessionLifetime } from "../../hooks/sessionLifetime.js";
import {
  blankProduct,
  asEditableProduct,
  productPriceLabel,
  readAdminWorkspace,
  slugify,
} from "./products/productUtils.js";
import {
  createCatalogSection,
  deleteProduct,
  deleteCatalogSection,
  getAdminProducts,
  getAdminSections,
  renameCatalogSection,
  saveCatalogSectionOrder,
  setCatalogSectionActive,
  setProductActive,
} from "../../services/admin.js";

function loadSiteSettingsManager() {
  return import("./SiteSettingsManager.jsx");
}

const SiteSettingsManager = lazy(loadSiteSettingsManager);
const ProductEditor = lazy(() => import("./products/ProductEditor.jsx"));
const draftDateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function ProductManager({ session, adminBrand, onAdminBrandChange, initialView }) {
  const [products, setProducts] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [sections, setSections] = useState([]);
  const [productDrafts, setProductDrafts] = useState([]);
  const [workspace, setWorkspace] = useState(() => {
    const savedWorkspace = readAdminWorkspace(session.user.id);
    return {
      ...savedWorkspace,
      activeView: initialView ?? (savedWorkspace.activeView === "site-settings" ? "site-settings" : "products"),
    };
  });
  const [persistenceError, setPersistenceError] = useState("");
  const activeView = workspace.activeView === "site-settings" ? "site-settings" : "products";
  const [settingsVisited, setSettingsVisited] = useState(activeView === "site-settings");
  const editorDraft = workspace.editorDraft ?? null;
  const editorProduct = editorDraft?.product ?? null;
  const [addingSection, setAddingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  const [savingSectionOrder, setSavingSectionOrder] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState("");
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [productsLoadError, setProductsLoadError] = useState("");
  const [error, setError] = useState("");
  const [savingVisibilityId, setSavingVisibilityId] = useState("");
  const productSearchTerm = productQuery.trim().toLowerCase();
  const sectionTitles = useMemo(() => new Map(sections.map((section) => [section.id, section.title])), [sections]);
  const filteredProducts = useMemo(() => (
    productSearchTerm
      ? products.filter((product) => (
        `${product.title} ${product.id} ${sectionTitles.get(product.sectionId) ?? ""}`
          .toLowerCase()
          .includes(productSearchTerm)
      ))
      : products
  ), [products, productSearchTerm, sectionTitles]);

  useEffect(() => {
    if (initialView) {
      if (initialView === "site-settings") setSettingsVisited(true);
      setWorkspace((current) => ({ ...current, activeView: initialView }));
    }
  }, [initialView]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);

  useEffect(() => {
    const prefetchTimer = window.setTimeout(() => {
      loadSiteSettingsManager().catch((loadError) => {
        console.error("Site settings could not be preloaded.", loadError);
      });
    }, 0);
    return () => window.clearTimeout(prefetchTimer);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(`petify-admin-workspace:${session.user.id}`, JSON.stringify(workspace));
      setPersistenceError("");
    } catch (storageError) {
      console.error("The admin workspace could not be saved for recovery.", storageError);
      setPersistenceError("This browser could not save your admin workspace for recovery. Keep this page open to avoid losing unsaved changes.");
    }
  }, [session.user.id, workspace]);

  const saveEditorDraft = useCallback((draft) => {
    setWorkspace((current) => ({
      ...current,
      editorDraft: draft ? {
        ...draft,
        key: current.editorDraft?.key ?? draft.key ?? draft.product.id ?? "new",
        isEditing: current.editorDraft?.isEditing ?? draft.isEditing ?? Boolean(draft.product.id),
      } : null,
    }));
  }, []);

  async function refreshProducts() {
    setLoading(true);
    setError("");
    try {
      const [nextProducts, nextSections] = await Promise.all([getAdminProducts(), getAdminSections()]);
      setProducts(nextProducts);
      setSections(nextSections);
      setProductsLoadError("");
    } catch (loadError) {
      const message = loadError.message || "Products could not be loaded.";
      setProductsLoadError(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProductDrafts() {
    try {
      setProductDrafts(await getWorkspaceDrafts(session.user.id, "product"));
    } catch (draftError) {
      setError(draftError.message || "Saved product drafts could not be loaded.");
    }
  }

  useEffect(() => { refreshProducts(); }, []);
  useEffect(() => { refreshProductDrafts(); }, [session.user.id]);

  function resumeProductDraft(savedDraft) {
    const savedForm = savedDraft.payload?.form ?? {};
    const savedProduct = products.find((product) => product.id === savedForm.id);
    const product = savedProduct
      ? asEditableProduct(savedProduct)
      : { ...blankProduct(products.length + 1, sections), ...savedForm };
    saveEditorDraft({
      key: savedDraft.draft_key,
      isEditing: Boolean(savedProduct),
      product,
      form: savedForm,
      images: savedDraft.payload?.images ?? [],
      pendingPhotoCount: 0,
    });
  }

  async function addSection(event) {
    event.preventDefault();
    const title = sectionTitle.trim();
    const id = slugify(title);
    if (!id) {
      setError("Enter a section name using letters or numbers.");
      return;
    }

    setCreatingSection(true);
    setError("");
    try {
      await createCatalogSection({ id, title, displayOrder: sections.length + 1 });
      setSections(await getAdminSections());
      setSectionTitle("");
      setAddingSection(false);
    } catch (createError) {
      setError(createError.message || "The section could not be created.");
    } finally {
      setCreatingSection(false);
    }
  }

  async function moveSection(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= sections.length || savingSectionOrder) return;

    const nextSections = [...sections];
    const [section] = nextSections.splice(index, 1);
    nextSections.splice(target, 0, section);
    setSections(nextSections);
    setSavingSectionOrder(true);
    setError("");
    try {
      await saveCatalogSectionOrder(nextSections);
    } catch (orderError) {
      setError(orderError.message || "The storefront section order could not be saved.");
      await refreshProducts();
    } finally {
      setSavingSectionOrder(false);
    }
  }

  async function saveSectionTitle(event, section) {
    event.preventDefault();
    const title = editingSectionTitle.trim();
    if (!title) {
      setError("Section name cannot be empty.");
      return;
    }

    setError("");
    try {
      await renameCatalogSection(section.id, title);
      setSections(await getAdminSections());
      setEditingSectionId("");
      setEditingSectionTitle("");
    } catch (renameError) {
      setError(renameError.message || "The section name could not be saved.");
    }
  }

  async function removeSection(section) {
    if (products.some((product) => product.sectionId === section.id)) {
      setError("Move or delete this section's products before deleting the section.");
      return;
    }
    if (!window.confirm(`Delete the ${section.title} section? This cannot be undone.`)) return;

    setError("");
    try {
      await deleteCatalogSection(section.id);
      setSections(await getAdminSections());
    } catch (deleteError) {
      setError(deleteError.message || "The section could not be deleted.");
    }
  }

  async function toggleSectionVisibility(section) {
    if (savingVisibilityId) return;
    setSavingVisibilityId(section.id);
    setError("");
    try {
      await setCatalogSectionActive(section.id, !section.is_active);
      setSections(await getAdminSections());
    } catch (visibilityError) {
      setError(visibilityError.message || "Section visibility could not be saved.");
    } finally {
      setSavingVisibilityId("");
    }
  }

  async function toggleProductVisibility(product) {
    if (savingVisibilityId) return;
    const isActive = !product.isActive;
    setSavingVisibilityId(product.id);
    setError("");
    try {
      await setProductActive(product.id, isActive);
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, isActive } : item));
    } catch (visibilityError) {
      setError(visibilityError.message || "Product visibility could not be saved.");
    } finally {
      setSavingVisibilityId("");
    }
  }

  async function removeProduct(product) {
    if (!window.confirm(`Delete ${product.title}? This cannot be undone.`)) return;
    try {
      await deleteProduct(product);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setError("");
    } catch (deleteError) {
      setError(deleteError.message || "The product could not be deleted.");
      await refreshProducts();
    }
  }

  async function signOut() {
    clearSessionLifetime(session);
    await supabase.auth.signOut();
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <a className="admin-brand" href="/">{adminBrand.name} <span>{adminBrand.label}</span></a>
        <AccountMenu email={session.user.email} onSignOut={signOut} />
      </header>
      <main className="admin-content">
        <WorkspaceSidebar items={createAdminNavigationItems(activeView, (view) => {
          if (view === "site-settings") {
            setSettingsVisited(true);
          }
          setWorkspace((current) => ({ ...current, activeView: view }));
        })} />
        <div className="admin-page-panel">
          {persistenceError && <p className="admin-error" role="alert">{persistenceError}</p>}
          <div hidden={activeView !== "site-settings"}>
            {settingsVisited && (
              <>
                <div className="admin-page-heading"><div><p className="admin-eyebrow">SITE CONFIGURATION</p><h1>Site settings</h1><p className="admin-muted">Manage your brand, content, and what appears on the storefront.</p></div></div>
                <Suspense fallback={<p className="admin-muted">Loading site settings...</p>}>
                  <SiteSettingsManager
                    adminBrand={adminBrand}
                    onAdminBrandChange={onAdminBrandChange}
                    userId={session.user.id}
                    sections={sections}
                    products={products}
                  />
                </Suspense>
              </>
            )}
          </div>
          <div hidden={activeView !== "products"}>
            {editorProduct ? (
              <Suspense fallback={<p className="admin-muted">Loading product editor...</p>}>
                <ProductEditor
                  key={editorDraft.key ?? editorProduct.id ?? "new"}
                  product={editorProduct}
                  draft={editorDraft}
                  products={products}
                  sections={sections}
                  userId={session.user.id}
                  onCancel={() => saveEditorDraft(null)}
                  onDraftChange={saveEditorDraft}
                  onDraftSaved={refreshProductDrafts}
                  onSave={async ({ closeEditor = true } = {}) => { await refreshProducts(); if (closeEditor) saveEditorDraft(null); }}
                />
              </Suspense>
            ) : (
              <>
              <div className="admin-page-heading">
                <div><p className="admin-eyebrow">CATALOG MANAGEMENT</p><h1>Products</h1><p className="admin-muted">Manage products, catalog sections, and what customers see in your store.</p></div>
                <div className="admin-heading-actions">
                  <button className="admin-secondary-button" type="button" onClick={() => setAddingSection((current) => !current)}>New section</button>
                  <button className="admin-primary-button" type="button" disabled={!sections.length} onClick={() => {
                    const product = blankProduct(products.length + 1, sections);
                    saveEditorDraft({ key: `new-${crypto.randomUUID()}`, isEditing: false, product, form: product, images: [], pendingPhotoCount: 0 });
                  }} title={!sections.length ? "Create a catalog section before adding a product" : undefined}>Add product</button>
                </div>
              </div>
              {!sections.length && !loading && (
                <p className="admin-product-setup-note" role="status">Create your first catalog section to start adding products. Use <strong>New section</strong> above.</p>
              )}
              {productDrafts.length > 0 && (
                <section className="admin-saved-drafts" aria-label="Saved product drafts">
                  <h2>Product drafts</h2>
                  <ul>
                    {productDrafts.map((savedDraft) => (
                      <li key={savedDraft.draft_key}>
                        <span>{savedDraft.payload?.form?.title || "Untitled product"} <small>Saved {draftDateFormatter.format(new Date(savedDraft.updated_at))}</small></span>
                        <button className="admin-secondary-button" type="button" onClick={() => resumeProductDraft(savedDraft)}>Resume draft</button>
                        <button className="admin-delete-button" type="button" onClick={async () => {
                          if (!window.confirm(`Discard the draft for ${savedDraft.payload?.form?.title || "this product"}? This cannot be undone.`)) return;
                          try {
                            await deleteWorkspaceDraft(session.user.id, "product", savedDraft.draft_key);
                            await refreshProductDrafts();
                          } catch (draftError) {
                            setError(draftError.message || "Product draft could not be deleted.");
                          }
                        }}>Discard</button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {addingSection && (
                <form className="admin-section-form" onSubmit={addSection}>
                  <label>Section name<input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} placeholder="Toys, Pets, Cages..." required /></label>
                  <button className="admin-primary-button" type="submit" disabled={creatingSection}>{creatingSection ? "Creating..." : "Create section"}</button>
                  <button className="admin-secondary-button" type="button" onClick={() => setAddingSection(false)}>Cancel</button>
                </form>
              )}
              {sections.length > 0 && (
                <section className="admin-section-order" aria-labelledby="admin-section-order-title">
                  <div className="admin-section-order-heading">
                    <div><h2 id="admin-section-order-title">Catalog sections</h2><p>Control the storefront order and visibility of your categories.</p></div>
                    <span>{sections.length} {sections.length === 1 ? "section" : "sections"}</span>
                  </div>
                  <ol>
                    {sections.map((section, index) => (
                      <li key={section.id}>
                        {editingSectionId === section.id ? (
                          <form className="admin-section-rename" onSubmit={(event) => saveSectionTitle(event, section)}>
                            <input aria-label={`Rename ${section.title}`} value={editingSectionTitle} onChange={(event) => setEditingSectionTitle(event.target.value)} required />
                            <button className="admin-primary-button" type="submit">Save</button>
                            <button className="admin-secondary-button" type="button" onClick={() => setEditingSectionId("")}>Cancel</button>
                          </form>
                        ) : (
                          <>
                            <span className="admin-section-order-name"><strong>{section.title}</strong><small>{section.id}</small></span>
                            <label className="admin-inline-switch"><input type="checkbox" role="switch" checked={section.is_active} disabled={Boolean(savingVisibilityId)} aria-label={`${section.is_active ? "Hide" : "Show"} ${section.title}`} onChange={() => toggleSectionVisibility(section)} /><span>{section.is_active ? "Visible" : "Hidden"}</span></label>
                            <span className="admin-section-order-actions">
                              <button className="admin-secondary-button admin-order-arrow" type="button" title="Move section earlier" aria-label={`Move ${section.title} earlier`} disabled={savingSectionOrder || index === 0} onClick={() => moveSection(index, -1)}>↑</button>
                              <button className="admin-secondary-button admin-order-arrow" type="button" title="Move section later" aria-label={`Move ${section.title} later`} disabled={savingSectionOrder || index === sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button>
                              <button className="admin-secondary-button" type="button" onClick={() => { setEditingSectionId(section.id); setEditingSectionTitle(section.title); }}>Rename</button>
                              <button className="admin-delete-button" type="button" disabled={products.some((product) => product.sectionId === section.id)} title={products.some((product) => product.sectionId === section.id) ? "Move or delete assigned products first" : "Delete section"} onClick={() => removeSection(section)}>Delete</button>
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {error && <p className="admin-error" role="alert">{error}</p>}
              {loading ? <p className="admin-muted">Loading products...</p> : productsLoadError ? (
                <div className="admin-products-load-error">
                  <p className="admin-error" role="alert">{productsLoadError}</p>
                  <button className="admin-secondary-button" type="button" onClick={refreshProducts}>Try loading again</button>
                </div>
              ) : (
                <>
                  <div className="admin-products-toolbar">
                    <div>
                      <h2>Products <span>{products.length}</span></h2>
                      <p>{productSearchTerm ? `Showing ${filteredProducts.length} of ${products.length} products.` : "Search and manage the items in your storefront."}</p>
                    </div>
                    <div className="admin-product-search">
                      <label className="admin-visually-hidden" htmlFor="admin-product-search">Search products</label>
                      <input id="admin-product-search" type="search" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Search name, ID, or section" />
                      {productQuery && <button type="button" aria-label="Clear product search" onClick={() => setProductQuery("")}>Clear</button>}
                    </div>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <caption className="admin-visually-hidden">Product catalog and management actions</caption>
                      <thead><tr><th>Product</th><th>Section</th><th>Price / varieties</th><th>Visibility</th><th>Actions</th></tr></thead>
                      <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id}>
                          <td data-label="Product"><div className="admin-product-cell">{product.images[0] ? <img src={product.images[0]} alt="" loading="lazy" decoding="async" /> : <span className="admin-product-placeholder" aria-hidden="true" />}<div><strong>{product.title}</strong><span>{product.id}</span></div></div></td>
                          <td data-label="Section">{sectionTitles.get(product.sectionId) || "Unassigned"}</td>
                          <td data-label="Price / varieties">{productPriceLabel(product)}</td>
                          <td data-label="Visibility"><label className="admin-inline-switch"><input type="checkbox" role="switch" checked={product.isActive} disabled={Boolean(savingVisibilityId)} aria-label={`${product.isActive ? "Hide" : "Show"} ${product.title}`} onChange={() => toggleProductVisibility(product)} /><span>{product.isActive ? "Visible" : "Hidden"}</span></label></td>
                          <td data-label="Actions"><div className="admin-row-actions"><button type="button" onClick={() => {
                            const editableProduct = asEditableProduct(product);
                            saveEditorDraft({ key: editableProduct.id, isEditing: true, product: editableProduct, form: editableProduct, images: editableProduct.images ?? [], pendingPhotoCount: 0 });
                          }}>Edit</button><button className="admin-delete-button" type="button" onClick={() => removeProduct(product)}>Delete</button></div></td>
                        </tr>
                      ))}
                      {!filteredProducts.length && <tr><td colSpan="5" className="admin-empty">{products.length ? "No products match that search. Try another name, ID, or section." : "No products yet. Add your first product to begin."}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
