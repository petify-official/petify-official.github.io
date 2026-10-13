import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadProductImages, saveProduct } from "../../../services/admin.js";
import { formatProductPrice } from "../../../lib/productPricing.js";
import useWorkspaceDraft from "../../../hooks/useWorkspaceDraft.js";
import { parseVariantPrice, resolveProductImageUrls, slugify } from "./productUtils.js";

const defaultOrderMessagePrefix = "Hi Petify, I want to order ";

function isDefaultOrderMessage(message, title) {
  if (!message) return true;
  if (message === `${defaultOrderMessagePrefix}${title}`) return true;
  if (!message.startsWith(defaultOrderMessagePrefix)) return false;
  return title.startsWith(message.slice(defaultOrderMessagePrefix.length));
}

export default function ProductEditor({ product, draft, products, sections, userId, onCancel, onDraftChange, onDraftSaved, onSave }) {
  const initialProductState = useRef(null);
  if (!initialProductState.current) {
    initialProductState.current = {
      form: {
        ...product,
        variants: product.variants ?? [],
        variantsEnabled: Boolean(product.variants?.length),
      },
      images: product.images ?? [],
    };
  }
  const { form: initialForm, images: initialImages } = initialProductState.current;
  const [form, setForm] = useState(() => ({
    ...initialForm,
    ...(draft?.form ?? {}),
  }));
  const [productIdCustomized, setProductIdCustomized] = useState(() => (
    !product.id && Boolean(draft?.form?.id) && draft.form.id !== slugify(draft.form.title)
  ));
  const [imageItems, setImageItems] = useState(() => (draft?.images ?? product.images ?? []).map((url, index) => ({ id: `existing-${index}`, url })));
  const [recoveredPhotoCount, setRecoveredPhotoCount] = useState(() => draft?.pendingPhotoCount ?? 0);
  const previewUrls = useRef(new Set());
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isEditing = draft?.isEditing ?? Boolean(product.id);
  const cloudDraftKey = draft?.key ?? product.id ?? "new-product";
  const cloudDraftValue = useMemo(() => ({
    form,
    images: imageItems.filter((item) => item.url).map((item) => item.url),
  }), [form, imageItems]);
  const restoreProductDraft = useCallback((savedDraft) => {
    if (savedDraft?.form) setForm((current) => ({ ...current, ...savedDraft.form }));
    if (Array.isArray(savedDraft?.images)) {
      setImageItems(savedDraft.images.map((url, index) => ({ id: `cloud-${index}`, url })));
    }
  }, []);
  const shouldSaveProductDraft = useCallback((value) => (
    isEditing
      ? JSON.stringify(value.form) !== JSON.stringify(initialForm)
        || JSON.stringify(value.images) !== JSON.stringify(initialImages)
      : Boolean(
      value.form.title?.trim()
      || value.form.description?.trim()
      || value.form.badge?.trim()
      || value.form.specsText?.trim()
      || value.form.defaultWhatsappMsg?.trim()
      || value.form.price
      || value.form.oldPrice
      || value.form.saveTag?.trim()
      || value.form.type !== "single"
      || value.form.variantsEnabled
      || value.form.variants?.some((variant) => variant.label?.trim() || variant.price || variant.oldPrice)
      || value.images.length
      || !value.form.isActive
      )
  ), [initialForm, initialImages, isEditing]);
  const productDraft = useWorkspaceDraft({
    userId,
    draftType: "product",
    draftKey: cloudDraftKey,
    value: cloudDraftValue,
    onRestore: restoreProductDraft,
    shouldSave: shouldSaveProductDraft,
  });

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  useEffect(() => {
    onDraftChange({
      product: { ...form, images: imageItems.filter((item) => item.url).map((item) => item.url) },
      isEditing,
      form,
      images: imageItems.filter((item) => item.url).map((item) => item.url),
      pendingPhotoCount: recoveredPhotoCount + imageItems.filter((item) => item.file).length,
    });
  }, [form, imageItems, recoveredPhotoCount, onDraftChange]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [...(current.variants ?? []), {
        id: crypto.randomUUID(),
        label: "",
        price: "",
        oldPrice: "",
      }],
    }));
  }

  function updateVariant(variantId, field, value) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) => (
        variant.id === variantId ? { ...variant, [field]: value } : variant
      )),
    }));
  }

  function removeVariant(variantId) {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.id !== variantId),
    }));
  }

  function toggleVariants(enabled) {
    setForm((current) => {
      if (enabled) return { ...current, variantsEnabled: true };
      const firstVariant = current.variants?.[0];
      if (!firstVariant) return { ...current, variantsEnabled: false, variants: [] };
      const price = parseVariantPrice(firstVariant.price);
      const oldPrice = firstVariant.oldPrice ? parseVariantPrice(firstVariant.oldPrice) : Number.NaN;
      return {
        ...current,
        variantsEnabled: false,
        variants: [],
        price: Number.isFinite(price) ? formatProductPrice(price) : current.price,
        oldPrice: Number.isFinite(oldPrice) ? formatProductPrice(oldPrice) : "",
      };
    });
  }

  function updateTitle(title) {
    setForm((current) => ({
      ...current,
      title,
      id: isEditing || productIdCustomized ? current.id : slugify(title),
      defaultWhatsappMsg: isDefaultOrderMessage(current.defaultWhatsappMsg, current.title)
        ? `${defaultOrderMessagePrefix}${title}`
        : current.defaultWhatsappMsg,
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

  function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
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
      const variants = form.variantsEnabled
        ? form.variants.map((variant) => ({
          ...variant,
          label: variant.label.trim(),
          price: parseVariantPrice(variant.price),
          oldPrice: variant.oldPrice === null || variant.oldPrice === undefined || String(variant.oldPrice).trim() === ""
            ? null
            : parseVariantPrice(variant.oldPrice),
        }))
        : [];
      if (form.variantsEnabled && !variants.length) {
        throw new Error("Add at least one variety or turn off purchasable varieties.");
      }
      if (variants.some((variant) => (
        !variant.label || !Number.isFinite(variant.price) || variant.price < 0
        || (variant.oldPrice !== null && (!Number.isFinite(variant.oldPrice) || variant.oldPrice < 0))
      ))) {
        throw new Error("Each variety needs a label and a valid price. Previous prices must also be valid amounts.");
      }
      if (new Set(variants.map((variant) => variant.label.toLowerCase())).size !== variants.length) {
        throw new Error("Each variety needs a unique label.");
      }
      const queuedFiles = imageItems.filter((item) => item.file);
      const uploaded = queuedFiles.length
        ? await uploadProductImages(id, queuedFiles.map((item) => item.file), ({ completed, total, fileName }) => {
          const percent = Math.round(5 + (completed / total) * 80);
          setUploadProgress({
            message: fileName ? `Uploading photos (${completed} of ${total} complete)` : `Uploaded ${completed} of ${total} photos`,
            currentFile: fileName,
            percent,
          });
        })
        : [];
      const images = resolveProductImageUrls(imageItems, uploaded);
      setUploadProgress({ message: "Saving product details...", percent: 92 });
      await saveProduct({
        ...form,
        id,
        isNew: !isEditing,
        specs: form.specsText.split("\n").map((item) => item.trim()).filter(Boolean),
        images,
        variants,
        displayOrder: Number(form.displayOrder) || 0,
      });
      let draftRemovalError = null;
      try {
        await productDraft.clear();
      } catch (clearError) {
        draftRemovalError = clearError;
      }
      setUploadProgress({ message: "Product saved", percent: 100 });
      await onDraftSaved?.();
      await onSave();
      if (draftRemovalError) {
        setError(`Product was published, but its saved draft could not be removed: ${draftRemovalError.message}`);
      }
    } catch (saveError) {
      setUploadProgress(null);
      setError(saveError.message || "The product could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProductDraft() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const queuedFiles = imageItems.filter((item) => item.file);
      const uploadedImages = queuedFiles.length
        ? await uploadProductImages("drafts", queuedFiles.map((item) => item.file))
        : [];
      const images = resolveProductImageUrls(imageItems, uploadedImages).filter(Boolean);
      const savedDraft = { form, images };
      await productDraft.saveNow(savedDraft);
      setImageItems(images.map((url, index) => ({ id: `draft-${index}`, url })));
      await onDraftSaved?.();
      setNotice("Product draft saved to your account. It is not published to the storefront.");
      return true;
    } catch (draftError) {
      setError(draftError.message || "Product draft could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function closeEditor() {
    if (!productDraft.loaded) return;
    if (await saveProductDraft()) onCancel();
  }

  async function discardProductDraft() {
    if (!window.confirm("Discard this product draft?")) return;
    setBusy(true);
    setError("");
    try {
      await productDraft.clear();
      await onDraftSaved?.();
      onCancel();
    } catch (draftError) {
      setError(draftError.message || "Product draft could not be discarded.");
    } finally {
      setBusy(false);
    }
  }

  async function clearAllData() {
    if (!window.confirm("Clear all unsaved product data and restore the starting values?")) return;
    setBusy(true);
    setError("");
    try {
      await productDraft.clear();
      imageItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      previewUrls.current.clear();
      setForm(initialForm);
      setImageItems(initialImages.map((url, index) => ({ id: `existing-${index}`, url })));
      setRecoveredPhotoCount(0);
      setProductIdCustomized(false);
      setError("");
      setNotice("Unsaved product data cleared.");
      await onDraftSaved?.();
    } catch (clearError) {
      setError(clearError.message || "Product data could not be cleared.");
    } finally {
      setBusy(false);
    }
  }

  const productIdIsValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.id);

  return (
    <form className="admin-editor product-editor" onSubmit={submit}>
      <header className="product-editor-header">
        <div>
          <p className="admin-eyebrow">{isEditing ? "CATALOG · EDIT PRODUCT" : "CATALOG · NEW PRODUCT"}</p>
          <h2>{isEditing ? form.title || "Edit product" : "Add a product"}</h2>
          <p className="admin-muted">Add the essentials first, then set pricing and photos. Your changes are saved as a draft automatically.</p>
        </div>
        <button className="admin-secondary-button" type="button" onClick={closeEditor} disabled={!productDraft.loaded || busy}>Save draft &amp; exit</button>
      </header>
      <nav className="product-editor-steps" aria-label="Product editor sections">
        <button type="button" onClick={() => scrollToSection("product-details")}>Details</button>
        <button type="button" onClick={() => scrollToSection("product-pricing")}>Pricing</button>
        <button type="button" onClick={() => scrollToSection("product-photos")}>Photos</button>
        <button type="button" onClick={() => scrollToSection("product-ordering")}>Ordering</button>
      </nav>
      {recoveredPhotoCount > 0 && (
        <p className="product-editor-message product-editor-message-warning" role="status">
          Your product draft was restored, but {recoveredPhotoCount} newly selected {recoveredPhotoCount === 1 ? "photo was" : "photos were"} not retained by the browser. Please select {recoveredPhotoCount === 1 ? "it" : "them"} again before saving.
        </p>
      )}
      {productDraft.error && <p className="product-editor-message product-editor-message-error" role="alert">{productDraft.error}</p>}
      {productDraft.restored && <p className="product-editor-message product-editor-message-success" role="status">Saved product draft restored. It is not published until you publish the product.</p>}
      {!sections.length && <p className="product-editor-message product-editor-message-warning" role="status">Create a catalog section before publishing a product.</p>}
      <fieldset className="product-editor-fields" disabled={!productDraft.loaded || busy}>
        <section className="product-editor-section" id="product-details" aria-labelledby="product-details-title">
          <div className="product-editor-section-heading">
            <span className="product-editor-section-number">01</span>
            <div><h3 id="product-details-title">Product details</h3><p>Name, category, and the information customers see first.</p></div>
          </div>
          <div className="product-editor-grid">
            <label className="product-editor-field-wide">Product name
              <input value={form.title} onChange={(event) => updateTitle(event.target.value)} placeholder="e.g. Everyday Cat Food" required />
            </label>
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
            <label>Badge
              <input value={form.badge} onChange={(event) => update("badge", event.target.value)} placeholder="e.g. Best seller" required />
            </label>
            <label>Display order
              <input type="number" min="0" step="1" value={form.displayOrder} onChange={(event) => update("displayOrder", event.target.value)} />
              <span className="admin-field-hint">Lower numbers appear first.</span>
            </label>
            {isEditing ? (
              <label className="product-editor-field-wide">Product ID
                <input value={form.id} readOnly />
                <span className="admin-field-hint">Fixed after creation; it identifies this product and its image folder.</span>
              </label>
            ) : (
              <label className="product-editor-field-wide">Product ID
                <input value={form.id} onChange={(event) => {
                  setProductIdCustomized(true);
                  update("id", event.target.value);
                }} required pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="product-id-hint" />
                <span className="admin-field-hint" id="product-id-hint">
                  {productIdIsValid ? "ID format looks good." : `Suggested: ${slugify(form.title) || "product-name"}. Use lowercase letters, numbers, and single hyphens.`}
                </span>
              </label>
            )}
            <label className="product-editor-field-wide">Description
              <textarea rows="4" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe what makes this product useful for your customers." required />
            </label>
            {form.type === "single" && (
              <label className="product-editor-field-wide">Product details <span className="product-editor-optional">Optional</span>
                <textarea rows="3" value={form.specsText} onChange={(event) => update("specsText", event.target.value)} placeholder={"One detail per line, for example:\nMaterial: Cotton\nSize: Medium"} />
              </label>
            )}
            {form.type === "combo" && (
              <label className="product-editor-field-wide">Offer tag <span className="product-editor-optional">Optional</span>
                <input value={form.saveTag} onChange={(event) => update("saveTag", event.target.value)} placeholder="e.g. Save ₹65" />
              </label>
            )}
          </div>
        </section>

        <section className="product-editor-section" id="product-pricing" aria-labelledby="product-pricing-title">
          <div className="product-editor-section-heading">
            <span className="product-editor-section-number">02</span>
            <div><h3 id="product-pricing-title">Pricing</h3><p>Set a product price or give customers a choice of varieties.</p></div>
          </div>
          <label className="product-editor-toggle">
            <input type="checkbox" checked={Boolean(form.variantsEnabled)} onChange={(event) => toggleVariants(event.target.checked)} />
            <span><strong>This product has varieties</strong><small>Use for sizes, quantities, or types with different prices.</small></span>
          </label>
          {form.variantsEnabled ? (
            <div className="product-variants-editor">
              <div className="product-variants-heading"><strong>Varieties and prices</strong><span>{form.variants?.length ?? 0} options</span></div>
              {(form.variants ?? []).map((variant, index) => (
                <div className="product-variant-row" key={variant.id}>
                  <label>Option {index + 1}
                    <input value={variant.label} onChange={(event) => updateVariant(variant.id, "label", event.target.value)} placeholder="e.g. 500 g" required />
                  </label>
                  <label>Price (₹)
                    <input type="text" inputMode="decimal" value={variant.price} onChange={(event) => updateVariant(variant.id, "price", event.target.value)} placeholder="1,299" required />
                  </label>
                  <label>Previous price (₹) <span className="product-editor-optional">Optional</span>
                    <input type="text" inputMode="decimal" value={variant.oldPrice ?? ""} onChange={(event) => updateVariant(variant.id, "oldPrice", event.target.value)} placeholder="1,499" />
                  </label>
                  <button className="admin-delete-button" type="button" aria-label={`Remove variety ${index + 1}`} onClick={() => removeVariant(variant.id)}>Remove</button>
                </div>
              ))}
              <button className="admin-secondary-button product-editor-add-button" type="button" onClick={addVariant}>＋ Add variety</button>
            </div>
          ) : (
            <div className="product-editor-grid product-editor-price-grid">
              <label>Price (₹)
                <input value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="e.g. ₹1,299" />
              </label>
              <label>Previous price (₹) <span className="product-editor-optional">Optional</span>
                <input value={form.oldPrice} onChange={(event) => update("oldPrice", event.target.value)} placeholder="e.g. ₹1,499" />
              </label>
            </div>
          )}
        </section>

        <section className="product-editor-section" id="product-photos" aria-labelledby="product-photos-title">
          <div className="product-editor-section-heading">
            <span className="product-editor-section-number">03</span>
            <div><h3 id="product-photos-title">Product photos</h3><p>Choose clear images. The first photo is used as the main catalog image.</p></div>
            <span className="product-photo-count">{imageItems.length} {imageItems.length === 1 ? "photo" : "photos"}</span>
          </div>
          <label className="product-photo-picker">
            <input type="file" accept="image/*" multiple onChange={(event) => {
              const selected = Array.from(event.target.files ?? []).map((file) => {
                const previewUrl = URL.createObjectURL(file);
                previewUrls.current.add(previewUrl);
                return { id: crypto.randomUUID(), file, previewUrl };
              });
              setImageItems((current) => [...current, ...selected]);
              event.target.value = "";
            }} />
            <span className="product-photo-picker-icon" aria-hidden="true">＋</span>
            <span><strong>Add photos</strong><small>Choose one or more image files</small></span>
          </label>
          {imageItems.length > 0 ? (
            <div className="admin-image-list" aria-label="Product photo order">
              {imageItems.map((item, index) => (
                <div className="admin-image-item" key={item.id}>
                  <img src={item.previewUrl || item.url} alt={`${form.title || "Product"} photo ${index + 1}`} loading="lazy" decoding="async" />
                  <span className="admin-image-order">{index === 0 ? "Main photo" : `Photo ${index + 1}`}{item.file ? " · New" : ""}</span>
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
          ) : (
            <p className="product-photo-empty">No photos added yet. You can publish without photos and add them later.</p>
          )}
        </section>

        <section className="product-editor-section" id="product-ordering" aria-labelledby="product-ordering-title">
          <div className="product-editor-section-heading">
            <span className="product-editor-section-number">04</span>
            <div><h3 id="product-ordering-title">Ordering and visibility</h3><p>Set the message customers send and choose whether this item is on sale.</p></div>
          </div>
          <div className="product-editor-grid">
            <label className="product-editor-field-wide">WhatsApp order message
              <input value={form.defaultWhatsappMsg} onChange={(event) => update("defaultWhatsappMsg", event.target.value)} placeholder={`Hi Petify, I want to order ${form.title || "..."}`} required />
              <span className="admin-field-hint">This message opens when a customer chooses to order the product.</span>
            </label>
            <label className="product-editor-toggle product-editor-visibility">
              <input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} />
              <span><strong>Visible in the storefront</strong><small>{form.isActive ? "Customers can see and order this product." : "This product stays hidden until you publish it as visible."}</small></span>
            </label>
          </div>
        </section>
      </fieldset>
      {error && <p className="product-editor-message product-editor-message-error" role="alert">{error}</p>}
      {notice && <p className="product-editor-message product-editor-message-success" role="status">{notice}</p>}
      {uploadProgress && (
        <div className="admin-upload-progress product-editor-progress" role="status" aria-live="polite">
          <div className="admin-upload-progress-label"><span>{uploadProgress.message}</span><span>{uploadProgress.percent}%</span></div>
          <div className="admin-upload-progress-track" role="progressbar" aria-label="Product save progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress.percent}>
            <div className="admin-upload-progress-fill" style={{ width: `${uploadProgress.percent}%` }} />
          </div>
          {uploadProgress.currentFile && <p className="admin-field-hint">{uploadProgress.currentFile}</p>}
        </div>
      )}
      <div className="product-editor-footer">
        <div className={`product-editor-footer-status${productDraft.error ? " has-error" : ""}`} role="status">
          <span className={`product-editor-save-dot${busy || productDraft.saving ? " is-saving" : ""}${productDraft.error ? " has-error" : ""}`} />
          {productDraft.error
            ? "Draft save needs attention"
            : !productDraft.loaded
            ? "Restoring your draft..."
            : busy || productDraft.saving
              ? "Saving your changes..."
              : productDraft.restored
                ? "Draft saved · autosaves as you edit"
                : "Draft autosave ready"}
        </div>
        <div className="product-editor-footer-actions">
          <button className="admin-delete-button" type="button" onClick={discardProductDraft} disabled={busy || !productDraft.loaded}>Discard draft</button>
          <button className="admin-secondary-button" type="button" onClick={clearAllData} disabled={busy || !productDraft.loaded}>Reset changes</button>
          <button className="admin-primary-button" type="submit" disabled={busy || !productDraft.loaded || !sections.length}>
            {busy ? "Publishing..." : isEditing ? "Save and publish" : "Publish product"}
          </button>
        </div>
      </div>
    </form>
  );
}
