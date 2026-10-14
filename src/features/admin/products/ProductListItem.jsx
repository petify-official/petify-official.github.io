import { useState } from "react";
import { useEffect } from "react";
import AdminButton from "../components/AdminButton.jsx";

export default function ProductListItem({
  product,
  sectionTitle,
  saving,
  deleting = false,
  onToggle,
  onEdit,
  onDelete,
  onSavePrice,
  onSaveStock,
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingStock, setEditingStock] = useState(false);
  const [price, setPrice] = useState(product.price ?? "");
  const [stock, setStock] = useState(String(product.stockQuantity ?? 0));
  const productLabel = product.title?.trim() || "Untitled product";

  useEffect(() => setPrice(product.price ?? ""), [product.price]);
  useEffect(() => setStock(String(product.stockQuantity ?? 0)), [product.stockQuantity]);

  async function submitPrice(event) {
    event.preventDefault();
    if (await onSavePrice(product, price)) setEditingPrice(false);
  }

  async function submitStock(event) {
    event.preventDefault();
    if (!/^\d+$/.test(stock) || !await onSaveStock(product, stock)) return;
    setEditingStock(false);
  }

  return (
    <article className="admin-product-card">
      <div className="admin-product-card-main">
        {product.images[0]
          ? <img src={product.images[0]} alt="" loading="lazy" decoding="async" />
          : <span className="admin-product-placeholder" aria-hidden="true" />}
        <div className="admin-product-card-copy">
          <strong>{productLabel}</strong>
          <span>{sectionTitle || "Unassigned"}</span>
          <span className="admin-product-card-price">{product.priceLabel}</span>
          <span>Stock: {product.stockQuantity ?? 0}</span>
        </div>
      </div>
      <div className="admin-product-card-controls">
        <label className="admin-inline-switch">
          <input
            type="checkbox"
            role="switch"
            checked={product.isActive}
            disabled={Boolean(saving)}
            aria-label={`${product.isActive ? "Hide" : "Show"} ${productLabel}`}
            onChange={onToggle}
          />
          <span>{product.isActive ? "Visible" : "Hidden"}</span>
        </label>
        <AdminButton variant="primary" onClick={onEdit}>Edit</AdminButton>
        <AdminButton className="admin-product-delete-direct" variant="danger" disabled={deleting} onClick={onDelete}>Delete</AdminButton>
        <details className="admin-product-overflow">
          <summary aria-label={`More actions for ${productLabel}`}>More</summary>
          <div>
            {!product.variants?.length && (
              <AdminButton onClick={() => setEditingPrice((current) => !current)}>
                {editingPrice ? "Cancel price edit" : "Quick edit price"}
              </AdminButton>
            )}
            <AdminButton onClick={() => setEditingStock((current) => !current)}>
              {editingStock ? "Cancel stock edit" : "Quick edit stock"}
            </AdminButton>
            <AdminButton variant="danger" disabled={deleting} onClick={onDelete}>Delete product</AdminButton>
          </div>
        </details>
      </div>
      {editingPrice && (
        <form className="admin-product-quick-price" onSubmit={submitPrice}>
          <label>
            Price (₹)
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              aria-label={`Price for ${productLabel}`}
              required
            />
          </label>
          <AdminButton variant="primary" type="submit" disabled={Boolean(saving)}>Save price</AdminButton>
        </form>
      )}
      {editingStock && (
        <form className="admin-product-quick-price" onSubmit={submitStock}>
          <label>
            Stock quantity
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              aria-label={`Stock quantity for ${productLabel}`}
            />
          </label>
          <AdminButton variant="primary" type="submit" disabled={Boolean(saving)}>Save stock</AdminButton>
        </form>
      )}
    </article>
  );
}
