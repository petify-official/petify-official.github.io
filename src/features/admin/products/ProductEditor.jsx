import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadProductImages, saveProduct } from "../../../services/admin.js";
import { formatProductPrice } from "../../../lib/productPricing.js";
import useWorkspaceDraft from "../../../hooks/useWorkspaceDraft.js";
import { parseVariantPrice, slugify } from "./productUtils.js";

export default function ProductEditor({ product, draft, products, sections, userId, onCancel, onDraftChange, onDraftSaved, onSave }) {
  const [form, setForm] = useState(() => ({
    ...product,
    variants: product.variants ?? [],
    variantsEnabled: Boolean(product.variants?.length),
    ...(draft?.form ?? {}),
  }));
  const [productIdCustomized, setProductIdCustomized] = useState(() => (
    !product.id && Boolean(draft?.form?.id) && draft.form.id !== slugify(draft.form.title)
  ));
  const [imageItems, setImageItems] = useState(() => (draft?.images ?? product.images ?? []).map((url, index) => ({ id: `existing-${index}`, url })));
  const [recoveredPhotoCount] = useState(() => draft?.pendingPhotoCount ?? 0);
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
  const productDraft = useWorkspaceDraft({
    userId,
    draftType: "product",
    draftKey: cloudDraftKey,
    value: cloudDraftValue,
    onRestore: restoreProductDraft,
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
      let uploadedIndex = 0;
      const images = imageItems.map((item) => item.file ? uploadedImages[uploadedIndex++] : item.url).filter(Boolean);
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
    if (!window.confirm("Discard this saved product draft?")) return;
    try {
      await productDraft.clear();
      setNotice("Saved product draft discarded.");
    } catch (draftError) {
      setError(draftError.message || "Product draft could not be discarded.");
    }
  }

  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="admin-editor-heading">
        <div>
          <p className="admin-eyebrow">{isEditing ? "EDIT PRODUCT" : "NEW PRODUCT"}</p>
          <h2>{isEditing ? form.title : "Add a product"}</h2>
        </div>
        <button className="admin-secondary-button" type="button" onClick={closeEditor} disabled={!productDraft.loaded || busy}>Save draft and close</button>
      </div>
      {recoveredPhotoCount > 0 && (
        <p className="admin-muted" role="status">
          Your product draft was restored, but {recoveredPhotoCount} newly selected {recoveredPhotoCount === 1 ? "photo was" : "photos were"} not retained by the browser. Please select {recoveredPhotoCount === 1 ? "it" : "them"} again before saving.
        </p>
      )}
      {productDraft.error && <p className="admin-error" role="alert">{productDraft.error}</p>}
      {productDraft.restored && <p className="admin-success" role="status">Saved product draft restored. Storefront changes remain unpublished until you publish this product.</p>}
      <fieldset className="admin-form-grid admin-editor-fields" disabled={!productDraft.loaded || busy}>
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
        <label className="admin-checkbox admin-span-two"><input type="checkbox" checked={Boolean(form.variantsEnabled)} onChange={(event) => toggleVariants(event.target.checked)} /> This product has purchasable varieties with different prices</label>
        {form.variantsEnabled ? (
          <fieldset className="product-variants-editor admin-span-two">
            <legend>Varieties and prices</legend>
            <p className="admin-field-hint">Add one option per size, pack quantity, or type. Keep the three gallery photos in Product photos; those are the product gallery, not separate varieties.</p>
            {(form.variants ?? []).map((variant, index) => (
              <div className="product-variant-row" key={variant.id}>
                <label>Option label<input value={variant.label} onChange={(event) => updateVariant(variant.id, "label", event.target.value)} placeholder="e.g. 250 g, 500 g, Pack of 4" required /></label>
                <label>Price (₹)<input type="text" inputMode="decimal" value={variant.price} onChange={(event) => updateVariant(variant.id, "price", event.target.value)} placeholder="1,299" required /></label>
                <label>Previous price (₹)<input type="text" inputMode="decimal" value={variant.oldPrice ?? ""} onChange={(event) => updateVariant(variant.id, "oldPrice", event.target.value)} placeholder="Optional" /></label>
                <button className="admin-delete-button" type="button" aria-label={`Remove variety ${index + 1}`} onClick={() => removeVariant(variant.id)}>Remove</button>
              </div>
            ))}
            <button className="admin-secondary-button" type="button" onClick={addVariant}>Add variety</button>
          </fieldset>
        ) : (
          <>
            <label>Price<input value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="₹1,299" /></label>
            <label>Previous price<input value={form.oldPrice} onChange={(event) => update("oldPrice", event.target.value)} placeholder="₹1,499" /></label>
          </>
        )}
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
      </fieldset>
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
        <button className="admin-secondary-button" type="button" onClick={saveProductDraft} disabled={busy || !productDraft.loaded}>{productDraft.saving ? "Saving draft..." : "Save as draft"}</button>
        {productDraft.restored && <button className="admin-secondary-button" type="button" onClick={discardProductDraft} disabled={busy || !productDraft.loaded}>Discard draft</button>}
        <button className="admin-primary-button" type="submit" disabled={busy || !productDraft.loaded}>{busy ? "Saving product..." : "Publish product"}</button>
        <button className="admin-secondary-button" type="button" onClick={closeEditor} disabled={!productDraft.loaded || busy}>Save draft and close</button>
      </div>
    </form>
  );
}
