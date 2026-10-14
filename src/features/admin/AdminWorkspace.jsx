import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { formatProductPrice } from "../../lib/productPricing.js";
import WorkspaceSidebar from "./WorkspaceSidebar.jsx";
import { createAdminNavigationItems } from "./adminNavigation.js";
import AccountMenu from "./AccountMenu.jsx";
import { deleteWorkspaceDraft, getWorkspaceDrafts } from "../../services/workspaceDrafts.js";
import { clearSessionLifetime } from "../../hooks/sessionLifetime.js";
import useConfirmDialog from "../../hooks/useConfirmDialog.js";
import useScrollAwareVisibility from "../../hooks/useScrollAwareVisibility.js";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import { formatDateTime } from "../../lib/formatters.js";
import AdminState from "./components/AdminState.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminButton from "./components/AdminButton.jsx";
import AdminTopbar from "./components/AdminTopbar.jsx";
import AdminBottomNav from "./components/AdminBottomNav.jsx";
import FilterSheet from "./components/FilterSheet.jsx";
import ProductListItem from "./products/ProductListItem.jsx";
import { parseVariantPrice } from "./products/productUtils.js";
import { parseProductPrice } from "../../lib/productPricing.js";
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
  setProductPrice,
  setProductActive,
  setProductStock,
} from "../../services/admin.js";

function loadSiteSettingsManager() {
  return import("./SiteSettingsManager.jsx");
}

const SiteSettingsManager = lazy(loadSiteSettingsManager);
const ProductEditor = lazy(() => import("./products/ProductEditor.jsx"));

export default function ProductManager({ session, adminBrand, onAdminBrandChange, initialView }) {
  const [products, setProducts] = useState([]);
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
  const [createActionsOpen, setCreateActionsOpen] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  const [savingSectionOrder, setSavingSectionOrder] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState("");
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingVisibilityId, setSavingVisibilityId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("all");
  const [productSectionFilter, setProductSectionFilter] = useState("all");
  const [productSort, setProductSort] = useState("display");
  const [stockDrafts, setStockDrafts] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState(null);
  const [finalizingDelete, setFinalizingDelete] = useState(false);
  const deleteTimer = useRef(0);
  const finalizingDeleteRef = useRef(false);
  const { confirm, dialogProps } = useConfirmDialog();
  const floatingActionsVisible = useScrollAwareVisibility();
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase();
    const matches = products.filter((product) => {
      const matchesSearch = !query
        || (product.title ?? "").toLocaleLowerCase().includes(query)
        || product.id.toLocaleLowerCase().includes(query);
      const matchesStatus = productStatusFilter === "all"
        || (productStatusFilter === "active" ? product.isActive : !product.isActive);
      const matchesSection = productSectionFilter === "all" || product.sectionId === productSectionFilter;
      return matchesSearch && matchesStatus && matchesSection;
    });
    const priceOf = (product) => product.variants?.length
      ? Math.min(...product.variants.map((variant) => Number(variant.price)))
      : parseProductPrice(product.price);
    if (productSort === "name") matches.sort((first, second) => (first.title ?? "").localeCompare(second.title ?? ""));
    if (productSort === "price-low") matches.sort((first, second) => priceOf(first) - priceOf(second));
    if (productSort === "price-high") matches.sort((first, second) => priceOf(second) - priceOf(first));
    return matches;
  }, [products, productSearch, productSectionFilter, productSort, productStatusFilter]);

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
        isEditing: draft.isEditing ?? current.editorDraft?.isEditing ?? Boolean(draft.product.id),
        isSavedDraft: draft.isSavedDraft ?? current.editorDraft?.isSavedDraft ?? false,
      } : null,
    }));
  }, []);

  async function refreshProducts() {
    setError("");
    try {
      const [nextProducts, nextSections] = await Promise.all([getAdminProducts(), getAdminSections()]);
      setProducts(nextProducts);
      setSections(nextSections);
    } catch (loadError) {
      setError(loadError.message || "Products could not be loaded.");
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
      : blankProduct(products.length + 1, sections);
    saveEditorDraft({
      key: savedDraft.draft_key,
      isEditing: Boolean(savedProduct),
      isSavedDraft: true,
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
    if (!await confirm({
      title: `Delete the ${section.title} section?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete section",
    })) return;

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

  async function saveQuickPrice(product, value) {
    const price = parseVariantPrice(value);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid product price.");
      return false;
    }

    setSavingVisibilityId(product.id);
    setError("");
    try {
      await setProductPrice(product.id, String(price));
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, price: String(price) } : item));
      return true;
    } catch (priceError) {
      setError(priceError.message || "The product price could not be saved.");
      return false;
    } finally {
      setSavingVisibilityId("");
    }
  }

  async function saveQuickStock(product, value) {
    const quantity = Number(value);
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2147483647) {
      setError("Stock must be a whole number of zero or more.");
      return false;
    }

    setSavingVisibilityId(product.id);
    setError("");
    try {
      await setProductStock(product.id, quantity);
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stockQuantity: quantity } : item));
      setStockDrafts((current) => ({ ...current, [product.id]: String(quantity) }));
      return true;
    } catch (stockError) {
      setError(stockError.message || "Product stock could not be saved.");
      return false;
    } finally {
      setSavingVisibilityId("");
    }
  }

  async function removeProduct(product) {
    if (!await confirm({
      title: `Delete ${product.title || "Untitled product"}?`,
      description: "The product will be removed in five seconds. You can undo this from the message at the bottom of the screen.",
      confirmLabel: "Delete product",
    })) return;

    if (pendingDeleteProduct) return;
    setProducts((current) => current.filter((item) => item.id !== product.id));
    setPendingDeleteProduct(product);
    deleteTimer.current = window.setTimeout(() => {
      void finalizeProductDelete(product);
    }, 5000);
  }

  async function finalizeProductDelete(product) {
    finalizingDeleteRef.current = true;
    setFinalizingDelete(true);
    try {
      await deleteProduct(product);
      setPendingDeleteProduct((current) => current?.id === product.id ? null : current);
      setError("");
    } catch (deleteError) {
      await refreshProducts();
      setError(deleteError.message || "The product could not be deleted.");
      setPendingDeleteProduct((current) => current?.id === product.id ? null : current);
      if (deleteError.message?.startsWith("Product deleted, but")) {
        setProducts((current) => current.filter((item) => item.id !== product.id));
      }
    } finally {
      finalizingDeleteRef.current = false;
      setFinalizingDelete(false);
    }
  }

  function undoProductDelete() {
    if (!pendingDeleteProduct || finalizingDeleteRef.current) return;
    window.clearTimeout(deleteTimer.current);
    setProducts((current) => [...current, pendingDeleteProduct].sort((first, second) => first.displayOrder - second.displayOrder));
    setPendingDeleteProduct(null);
  }

  function requestProductDelete(product) {
    if (pendingDeleteProduct) {
      setError("Undo or wait for the current delete to finish before deleting another product.");
      return;
    }
    void removeProduct(product);
  }

  async function signOut() {
    clearSessionLifetime(session);
    await supabase.auth.signOut();
  }

  function selectWorkspaceView(view) {
    if (view === "site-settings") setSettingsVisited(true);
    setWorkspace((current) => ({ ...current, activeView: view }));
  }

  return (
    <div className="admin-shell">
      <ConfirmDialog {...dialogProps} />
      <AdminTopbar
        brand={adminBrand}
        pageTitle={editorProduct ? (editorProduct.id ? "Edit product" : "Add product") : activeView === "site-settings" ? "Site settings" : "Products"}
      >
        <AccountMenu email={session.user.email} onSignOut={signOut} />
      </AdminTopbar>
      <main className="admin-content">
        <WorkspaceSidebar items={createAdminNavigationItems(activeView, selectWorkspaceView)} />
        <div className="admin-page-panel">
          {persistenceError && <AdminNotice kind="error">{persistenceError}</AdminNotice>}
          {pendingDeleteProduct && (
            <AdminNotice kind="info" as="div" className="admin-undo-notice">
              <span>{pendingDeleteProduct.title} will be deleted shortly.</span>
              <AdminButton disabled={finalizingDelete} onClick={undoProductDelete}>{finalizingDelete ? "Deleting..." : "Undo"}</AdminButton>
            </AdminNotice>
          )}
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
                <div><p className="admin-eyebrow">CATALOG MANAGEMENT</p><h1>Products</h1><p className="admin-muted">Manage products and their storefront sections.</p></div>
              </div>
              <div className={`admin-create-fab${floatingActionsVisible ? "" : " is-scroll-hidden"}`} aria-hidden={!floatingActionsVisible} inert={!floatingActionsVisible}>
                {addingSection ? (
                  <form className="admin-section-form admin-section-fab-form" onSubmit={addSection}>
                    <div className="admin-section-fab-heading">
                      <strong>New catalog section</strong>
                      <AdminButton aria-label="Close new section form" onClick={() => { setAddingSection(false); setSectionTitle(""); }}>×</AdminButton>
                    </div>
                    <label>Section name<input autoFocus value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} placeholder="Toys, Pets, Cages..." required /></label>
                    <button className="admin-primary-button" type="submit" disabled={creatingSection}>{creatingSection ? "Creating..." : "Create section"}</button>
                    <button className="admin-secondary-button" type="button" onClick={() => { setAddingSection(false); setSectionTitle(""); }}>Cancel</button>
                  </form>
                ) : (
                  <>
                    {createActionsOpen && (
                      <div className="admin-create-menu" role="group" aria-label="Create catalog item">
                        <AdminButton
                          variant="primary"
                          disabled={!sections.length}
                          onClick={() => {
                            const product = blankProduct(products.length + 1, sections);
                            setCreateActionsOpen(false);
                            saveEditorDraft({ key: `new-${crypto.randomUUID()}`, isEditing: false, product, form: product, images: [], pendingPhotoCount: 0 });
                          }}
                        >
                          Add product
                        </AdminButton>
                        {!sections.length && <span>Create a section before adding products.</span>}
                        <AdminButton onClick={() => { setCreateActionsOpen(false); setAddingSection(true); }}>New section</AdminButton>
                      </div>
                    )}
                    <AdminButton
                      variant="primary"
                      className="admin-fab-add"
                      aria-expanded={createActionsOpen}
                      aria-label={createActionsOpen ? "Close create menu" : "Create"}
                      onClick={() => setCreateActionsOpen((current) => !current)}
                    >
                      {createActionsOpen ? "Close" : "Create +"}
                    </AdminButton>
                  </>
                )}
              </div>
              <div className="admin-product-toolbar">
                <label className="admin-product-search">
                  <span>Search products</span>
                  <input
                    type="search"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search by name or product ID"
                  />
                </label>
                <AdminButton onClick={() => setFiltersOpen(true)}>
                  Filters{(productStatusFilter !== "all" || productSectionFilter !== "all" || productSort !== "display") ? " · active" : ""}
                </AdminButton>
                <span className="admin-product-result-count">{filteredProducts.length} products</span>
              </div>
              {productDrafts.length > 0 && (
                <section className="admin-saved-drafts" aria-label="Saved product drafts">
                  <h2>Product drafts</h2>
                  <ul>
                    {productDrafts.map((savedDraft) => (
                      <li key={savedDraft.draft_key}>
                        <span>{savedDraft.payload?.form?.title || "Untitled product"} <small>Saved {formatDateTime(savedDraft.updated_at)}</small></span>
                        <AdminButton onClick={() => resumeProductDraft(savedDraft)}>Resume draft</AdminButton>
                        <AdminButton variant="danger" onClick={async () => {
                          if (!await confirm({
                            title: `Delete the ${savedDraft.payload?.form?.title || "untitled product"} draft?`,
                            description: "The saved draft data will be permanently removed. Photos already uploaded to storage are not removed automatically.",
                            confirmLabel: "Delete draft",
                          })) return;
                          try {
                            await deleteWorkspaceDraft(session.user.id, "product", savedDraft.draft_key);
                            await refreshProductDrafts();
                          } catch (draftError) {
                            setError(draftError.message || "Product draft could not be deleted.");
                          }
                        }}>Discard</AdminButton>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {sections.length > 0 && (
                <section className="admin-section-order" aria-labelledby="admin-section-order-title">
                  <h2 id="admin-section-order-title">Catalog sections</h2>
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
              {error && <AdminNotice kind="error">{error}</AdminNotice>}
              {loading ? <AdminState kind="loading" description="Loading products..." /> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Product</th><th>Section</th><th>Price / varieties</th><th>Stock</th><th>Visibility</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id}>
                          <td><div className="admin-product-cell">{product.images[0] ? <img src={product.images[0]} alt="" /> : <span className="admin-product-placeholder" aria-hidden="true" />}<div><strong>{product.title || "Untitled product"}</strong><span>{product.id}</span></div></div></td>
                          <td>{sections.find((section) => section.id === product.sectionId)?.title || "Unassigned"}</td>
                          <td>{productPriceLabel(product)}</td>
                          <td>
                            <form className="admin-stock-inline" onSubmit={(event) => {
                              event.preventDefault();
                              void saveQuickStock(product, stockDrafts[product.id] ?? String(product.stockQuantity ?? 0));
                            }}>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1"
                                required
                                aria-label={`Stock quantity for ${product.title || "Untitled product"}`}
                                value={stockDrafts[product.id] ?? String(product.stockQuantity ?? 0)}
                                onChange={(event) => setStockDrafts((current) => ({ ...current, [product.id]: event.target.value }))}
                              />
                              <AdminButton type="submit" disabled={savingVisibilityId === product.id}>Save</AdminButton>
                            </form>
                          </td>
                          <td><label className="admin-inline-switch"><input type="checkbox" role="switch" checked={product.isActive} disabled={Boolean(savingVisibilityId)} aria-label={`${product.isActive ? "Hide" : "Show"} ${product.title || "Untitled product"}`} onChange={() => toggleProductVisibility(product)} /><span>{product.isActive ? "Visible" : "Hidden"}</span></label></td>
                          <td><div className="admin-row-actions"><button type="button" onClick={() => {
                            const editableProduct = asEditableProduct(product);
                            saveEditorDraft({ key: editableProduct.id, isEditing: true, product: editableProduct, form: editableProduct, images: editableProduct.images ?? [], pendingPhotoCount: 0 });
                          }}>Edit</button><AdminButton variant="danger" disabled={Boolean(pendingDeleteProduct)} onClick={() => requestProductDelete(product)}>Delete</AdminButton></div></td>
                        </tr>
                      ))}
                      {!filteredProducts.length && <tr><AdminState as="td" colSpan="6" description={products.length ? "No products match these search and filter settings." : "No products yet. Add your first product to begin."} /></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="admin-product-list" aria-label="Products">
                {filteredProducts.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={{ ...product, priceLabel: productPriceLabel(product) }}
                    sectionTitle={sections.find((section) => section.id === product.sectionId)?.title}
                    saving={savingVisibilityId === product.id}
                    deleting={Boolean(pendingDeleteProduct)}
                    onToggle={() => toggleProductVisibility(product)}
                    onEdit={() => {
                      const editableProduct = asEditableProduct(product);
                      saveEditorDraft({ key: editableProduct.id, isEditing: true, product: editableProduct, form: editableProduct, images: editableProduct.images ?? [], pendingPhotoCount: 0 });
                    }}
                    onDelete={() => requestProductDelete(product)}
                    onSavePrice={saveQuickPrice}
                    onSaveStock={saveQuickStock}
                  />
                ))}
                {!filteredProducts.length && (
                  <AdminState
                    title={products.length ? "No matching products" : "No products yet"}
                    description={products.length ? "Try another search or adjust the filters." : "Add your first product to begin."}
                  />
                )}
              </div>
              </>
            )}
          </div>
        </div>
      </main>
      <FilterSheet open={filtersOpen && activeView === "products"} title="Filter and sort products" onClose={() => setFiltersOpen(false)}>
        <label>
          Visibility
          <select value={productStatusFilter} onChange={(event) => setProductStatusFilter(event.target.value)}>
            <option value="all">All products</option>
            <option value="active">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label>
          Catalog section
          <select value={productSectionFilter} onChange={(event) => setProductSectionFilter(event.target.value)}>
            <option value="all">All sections</option>
            {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select>
        </label>
        <label>
          Sort by
          <select value={productSort} onChange={(event) => setProductSort(event.target.value)}>
            <option value="display">Storefront order</option>
            <option value="name">Name</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </label>
        <div className="admin-filter-sheet-actions">
          <AdminButton onClick={() => {
            setProductStatusFilter("all");
            setProductSectionFilter("all");
            setProductSort("display");
          }}>Reset filters</AdminButton>
          <AdminButton variant="primary" onClick={() => setFiltersOpen(false)}>Show {filteredProducts.length} products</AdminButton>
        </div>
      </FilterSheet>
      <AdminBottomNav items={[
        { id: "products", label: "Products", icon: "▦", active: activeView === "products", onClick: () => selectWorkspaceView("products") },
        { id: "dashboard", label: "Dashboard", icon: "◷", href: "/#petify-dashboard" },
        { id: "settings", label: "Settings", icon: "⚙", active: activeView === "site-settings", onClick: () => selectWorkspaceView("site-settings") },
      ]} />
    </div>
  );
}
