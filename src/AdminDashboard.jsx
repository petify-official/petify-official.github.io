import React, { useEffect, useRef, useState } from "react";
import SiteSettingsManager from "./features/admin/SiteSettingsManager.jsx";
import { supabase } from "./lib/supabase.js";
import { DEFAULT_ADMIN_BRAND, normalizeAdminBrand } from "./config/siteAppearance.js";
import {
  createCatalogSection,
  deleteProduct,
  deleteCatalogSection,
  getAdminProducts,
  getAdminSections,
  renameCatalogSection,
  saveCatalogSectionOrder,
  saveProduct,
  setCatalogSectionActive,
  setProductActive,
  uploadProductImages,
} from "./services/admin.js";

const blankProduct = (displayOrder, sections) => ({
  id: "",
  type: "single",
  sectionId: sections[0]?.id ?? "",
  badge: "",
  title: "",
  description: "",
  specsText: "",
  images: [],
  saveTag: "",
  price: "",
  oldPrice: "",
  defaultWhatsappMsg: "",
  isActive: true,
  displayOrder,
});

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function asEditableProduct(product) {
  return {
    ...product,
    specsText: (product.specs ?? []).map((spec) => String(spec).replace(/<[^>]*>/g, "")).join("\n"),
  };
}

function AdminLogin({ adminBrand, onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onSignedIn(data.session);
  }

  return (
    <form className="admin-login" onSubmit={submit}>
      <p className="admin-eyebrow">{`${adminBrand.name} ${adminBrand.label}`}</p>
      <h1>Admin sign in</h1>
      <p className="admin-muted">Sign in with the account you created in Supabase Authentication.</p>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      <a className="admin-back-link" href="/">Back to storefront</a>
    </form>
  );
}

function ProductEditor({ product, products, sections, onCancel, onSave }) {
  const [form, setForm] = useState(product);
  const [productIdCustomized, setProductIdCustomized] = useState(false);
  const [imageItems, setImageItems] = useState(() => (product.images ?? []).map((url, index) => ({ id: `existing-${index}`, url })));
  const previewUrls = useRef(new Set());
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isEditing = Boolean(product.id);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateTitle(title) {
    setForm((current) => ({
      ...current,
      title,
      id: isEditing || productIdCustomized ? current.id : slugify(title),
      defaultWhatsappMsg: current.defaultWhatsappMsg || `Hi Petify, I want to order ${title}`,
    }));
  }

  function moveImage(index, direction) {
    setImageItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setUploadProgress({ message: "Preparing product save...", percent: 3 });

    try {
      const id = form.id.trim();
      if (!id) throw new Error("Add a product title to create its product ID.");
      if (!isEditing && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
        throw new Error("Product IDs must use lowercase letters, numbers, and single hyphens between words.");
      }
      if (!isEditing && products.some((existingProduct) => existingProduct.id === id)) {
        throw new Error(`The product ID "${id}" is already in use. Choose a different ID.`);
      }
      const queuedFiles = imageItems.filter((item) => item.file);
      const uploaded = queuedFiles.length
        ? await uploadProductImages(id, queuedFiles.map((item) => item.file), ({ completed, total, fileName }) => {
          const percent = Math.round(5 + (completed / total) * 80);
          setUploadProgress({
            message: fileName ? `Uploading photo ${completed + 1} of ${total}` : `Uploaded ${completed} of ${total} photos`,
            currentFile: fileName,
            percent,
          });
        })
        : [];
      let uploadedIndex = 0;
      const images = imageItems.map((item) => item.file ? uploaded[uploadedIndex++] : item.url);
      setUploadProgress({ message: "Saving product details...", percent: 92 });
      await saveProduct({
        ...form,
        id,
        isNew: !isEditing,
        specs: form.specsText.split("\n").map((item) => item.trim()).filter(Boolean),
        images,
        displayOrder: Number(form.displayOrder) || 0,
      });
      setUploadProgress({ message: "Product saved", percent: 100 });
      await onSave();
    } catch (saveError) {
      setUploadProgress(null);
      setError(saveError.message || "The product could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="admin-editor-heading">
        <div>
          <p className="admin-eyebrow">{isEditing ? "EDIT PRODUCT" : "NEW PRODUCT"}</p>
          <h2>{isEditing ? form.title : "Add a product"}</h2>
        </div>
        <button className="admin-secondary-button" type="button" onClick={onCancel}>Close</button>
      </div>
      <div className="admin-form-grid">
        <label>Store section
          <select value={form.sectionId} onChange={(event) => update("sectionId", event.target.value)} required>
            {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select>
        </label>
        <label>Product type
          <select value={form.type} onChange={(event) => update("type", event.target.value)}>
            <option value="single">Standard product</option>
            <option value="combo">Combo offer</option>
          </select>
        </label>
        <label>Badge<input value={form.badge} onChange={(event) => update("badge", event.target.value)} required /></label>
        <label className="admin-span-two">Product name<input value={form.title} onChange={(event) => updateTitle(event.target.value)} required /></label>
        {isEditing ? (
          <label>Product ID<input value={form.id} readOnly /><span className="admin-field-hint">This ID is fixed after creation because it identifies the saved product and its image folder.</span></label>
        ) : (
          <label className="admin-span-two">Product ID<input value={form.id} onChange={(event) => {
            setProductIdCustomized(true);
            update("id", event.target.value);
          }} required aria-describedby="product-id-hint" />
            <span className="admin-field-hint" id="product-id-hint">
              Suggested from the product name: <strong>{slugify(form.title) || "Enter a product name"}</strong>. This unique ID identifies the product and its image folder. You can change it before saving; use lowercase letters, numbers, and hyphens.
            </span>
          </label>
        )}
        <label>Display order<input type="number" min="0" step="1" value={form.displayOrder} onChange={(event) => update("displayOrder", event.target.value)} /></label>
        <label className="admin-span-two">Description<textarea rows="3" value={form.description} onChange={(event) => update("description", event.target.value)} required /></label>
        {form.type === "single" && <label className="admin-span-two">Product details, one per line<textarea rows="4" value={form.specsText} onChange={(event) => update("specsText", event.target.value)} placeholder={"Material: Cotton\nSize: Medium"} /></label>}
        {form.type === "combo" && <label>Offer tag<input value={form.saveTag} onChange={(event) => update("saveTag", event.target.value)} placeholder="SAVE ₹65" /></label>}
        <label>Price<input value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="₹599" /></label>
        <label>Previous price<input value={form.oldPrice} onChange={(event) => update("oldPrice", event.target.value)} placeholder="₹664" /></label>
        <label className="admin-span-two">WhatsApp order message<input value={form.defaultWhatsappMsg} onChange={(event) => update("defaultWhatsappMsg", event.target.value)} required /></label>
        <label className="admin-span-two">Product photos<input type="file" accept="image/*" multiple onChange={(event) => {
          const selected = Array.from(event.target.files ?? []).map((file) => {
            const previewUrl = URL.createObjectURL(file);
            previewUrls.current.add(previewUrl);
            return { id: crypto.randomUUID(), file, previewUrl };
          });
          setImageItems((current) => [...current, ...selected]);
          event.target.value = "";
        }} /><span className="admin-field-hint">Select multiple photos at once, or add more before saving.</span></label>
        {imageItems.length > 0 && (
          <div className="admin-image-list admin-span-two" aria-label="Product photo order">
            {imageItems.map((item, index) => (
              <div className="admin-image-item" key={item.id}>
                <img src={item.previewUrl || item.url} alt={`${form.title} photo ${index + 1}`} />
                <span className="admin-image-order">Photo {index + 1}{item.file ? " · New" : ""}</span>
                <div className="admin-image-actions">
                  <button className="admin-secondary-button" type="button" title="Move earlier" aria-label={`Move photo ${index + 1} earlier`} disabled={index === 0} onClick={() => moveImage(index, -1)}>↑</button>
                  <button className="admin-secondary-button" type="button" title="Move later" aria-label={`Move photo ${index + 1} later`} disabled={index === imageItems.length - 1} onClick={() => moveImage(index, 1)}>↓</button>
                  <button className="admin-remove-image-button" type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => {
                    setImageItems((current) => current.filter((_, imageIndex) => imageIndex !== index));
                    if (item.previewUrl) {
                      URL.revokeObjectURL(item.previewUrl);
                      previewUrls.current.delete(item.previewUrl);
                    }
                  }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="admin-checkbox admin-span-two"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} /> Visible in the storefront</label>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}
      {uploadProgress && (
        <div className="admin-upload-progress" role="status" aria-live="polite">
          <div className="admin-upload-progress-label"><span>{uploadProgress.message}</span><span>{uploadProgress.percent}%</span></div>
          <div className="admin-upload-progress-track" role="progressbar" aria-label="Product save progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress.percent}>
            <div className="admin-upload-progress-fill" style={{ width: `${uploadProgress.percent}%` }} />
          </div>
          {uploadProgress.currentFile && <p className="admin-field-hint">{uploadProgress.currentFile}</p>}
        </div>
      )}
      <div className="admin-form-actions">
        <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Saving product..." : "Save product"}</button>
        <button className="admin-secondary-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ProductManager({ session, adminBrand, onAdminBrandChange }) {
  const [products, setProducts] = useState([]);
  const [sections, setSections] = useState([]);
  const [editorProduct, setEditorProduct] = useState(null);
  const [activeView, setActiveView] = useState("products");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  const [savingSectionOrder, setSavingSectionOrder] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState("");
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingVisibilityId, setSavingVisibilityId] = useState("");

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

  useEffect(() => { refreshProducts(); }, []);

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
    await supabase.auth.signOut();
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <a className="admin-brand" href="/">{adminBrand.name} <span>{adminBrand.label}</span></a>
        <div className="admin-user"><span>{session.user.email}</span><button onClick={signOut}>Sign out</button></div>
      </header>
      <main className="admin-content">
        <nav className="admin-sidebar" aria-label="Admin pages">
          <p className="admin-eyebrow">WORKSPACE</p>
          <button type="button" className={activeView === "products" ? "active" : ""} aria-current={activeView === "products" ? "page" : undefined} onClick={() => setActiveView("products")}>Products</button>
          <button type="button" className={activeView === "site-settings" ? "active" : ""} aria-current={activeView === "site-settings" ? "page" : undefined} onClick={() => { setActiveView("site-settings"); setEditorProduct(null); }}>Site settings</button>
          <a href="/">View storefront</a>
        </nav>
        <div className="admin-page-panel">
          {activeView === "site-settings" ? (
            <>
              <div className="admin-page-heading"><div><p className="admin-eyebrow">SITE CONFIGURATION</p><h1>Site settings</h1><p className="admin-muted">Manage your brand, content, and what appears on the storefront.</p></div></div>
              <SiteSettingsManager adminBrand={adminBrand} onAdminBrandChange={onAdminBrandChange} />
            </>
          ) : editorProduct ? (
            <ProductEditor
              key={editorProduct.id || "new"}
              product={editorProduct}
              products={products}
              sections={sections}
              onCancel={() => setEditorProduct(null)}
              onSave={async ({ closeEditor = true } = {}) => { await refreshProducts(); if (closeEditor) setEditorProduct(null); }}
            />
          ) : (
            <>
              <div className="admin-page-heading">
                <div><p className="admin-eyebrow">CATALOG MANAGEMENT</p><h1>Products</h1><p className="admin-muted">Manage products and their storefront sections.</p></div>
                <div className="admin-heading-actions">
                  <button className="admin-secondary-button" type="button" onClick={() => setAddingSection((current) => !current)}>New section</button>
                  <button className="admin-primary-button" type="button" disabled={!sections.length} onClick={() => setEditorProduct(blankProduct(products.length + 1, sections))}>Add product</button>
                </div>
              </div>
              {addingSection && (
                <form className="admin-section-form" onSubmit={addSection}>
                  <label>Section name<input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} placeholder="Toys, Pets, Cages..." required /></label>
                  <button className="admin-primary-button" type="submit" disabled={creatingSection}>{creatingSection ? "Creating..." : "Create section"}</button>
                  <button className="admin-secondary-button" type="button" onClick={() => setAddingSection(false)}>Cancel</button>
                </form>
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
              {error && <p className="admin-error" role="alert">{error}</p>}
              {loading ? <p className="admin-muted">Loading products...</p> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Product</th><th>Section</th><th>Price</th><th>Visibility</th><th>Actions</th></tr></thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id}>
                          <td><div className="admin-product-cell">{product.images[0] ? <img src={product.images[0]} alt="" /> : <span className="admin-product-placeholder" aria-hidden="true" />}<div><strong>{product.title}</strong><span>{product.id}</span></div></div></td>
                          <td>{sections.find((section) => section.id === product.sectionId)?.title || "Unassigned"}</td>
                          <td>{product.price || "—"}</td>
                          <td><label className="admin-inline-switch"><input type="checkbox" role="switch" checked={product.isActive} disabled={Boolean(savingVisibilityId)} aria-label={`${product.isActive ? "Hide" : "Show"} ${product.title}`} onChange={() => toggleProductVisibility(product)} /><span>{product.isActive ? "Visible" : "Hidden"}</span></label></td>
                          <td><div className="admin-row-actions"><button type="button" onClick={() => setEditorProduct(asEditableProduct(product))}>Edit</button><button className="admin-delete-button" type="button" onClick={() => removeProduct(product)}>Delete</button></div></td>
                        </tr>
                      ))}
                      {!products.length && <tr><td colSpan="5" className="admin-empty">No products yet. Add your first product to begin.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminDashboard({ adminBrand: initialAdminBrand }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [adminBrand, setAdminBrand] = useState(() => normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND));

  useEffect(() => {
    if (initialAdminBrand) setAdminBrand(normalizeAdminBrand(initialAdminBrand));
  }, [initialAdminBrand]);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      setSession(data.session);
      setSetupError(error?.message ?? "");
      setCheckingSession(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    async function checkRole() {
      if (!session || !supabase) {
        setIsAdmin(false);
        return;
      }
      setCheckingRole(true);
      setSetupError("");
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active) return;
      setIsAdmin(Boolean(data));
      setSetupError(error?.message ?? "");
      setCheckingRole(false);
    }
    checkRole();
    return () => { active = false; };
  }, [session]);

  if (!supabase) {
    return <div className="admin-gate"><div><p className="admin-eyebrow">SUPABASE SETUP</p><h1>Connect your project first</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart Vite.</p><a href="/">Back to storefront</a></div></div>;
  }

  if (checkingSession || checkingRole) {
    return <div className="admin-gate"><p className="admin-muted">Checking admin access...</p></div>;
  }

  if (!session) return <AdminLogin adminBrand={adminBrand} onSignedIn={setSession} />;

  if (!isAdmin) {
    return (
      <div className="admin-gate">
        <div><p className="admin-eyebrow">ACCESS NOT ASSIGNED</p><h1>Your account is not an admin yet</h1><p>In Supabase, copy this user ID from Authentication → Users, then insert it into <code>public.admin_users</code> from the SQL Editor.</p><code className="admin-user-id">{session.user.id}</code>{setupError && <p className="admin-error">{setupError}</p>}<p className="admin-gate-actions"><button className="admin-secondary-button" onClick={() => window.location.reload()}>Check again</button><button className="admin-secondary-button" onClick={() => supabase.auth.signOut()}>Sign out</button></p></div>
      </div>
    );
  }

  return <ProductManager session={session} adminBrand={adminBrand} onAdminBrandChange={setAdminBrand} />;
}