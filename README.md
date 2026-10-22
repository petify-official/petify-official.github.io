# Petify Official

Petify's product catalog is a React + Vite web app. Products, sections, and all editable storefront content are loaded from Supabase. If Supabase is unavailable, the storefront shows an error instead of displaying stale local data. The browser does not use local storage as a data source.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Run `npm run dev` and open the URL Vite prints.

## Connect Supabase and enable admin product management

1. Create a Supabase project.
2. Run `supabase/core-01-schema.sql` to create the core product table.
3. Run `supabase/admin-02-access.sql` to create the admin role, product write policies, and public image bucket.
4. Run `supabase/catalog-03-sections.sql` to add configurable main sections and subsections, section management permissions, and public store settings for brand, contact information, content, logo, hero navigation, the editable About page, storefront visibility, and the editable footer version number. Subsections can be assigned to a main section or left standalone. Rerun this script after updates to apply later additions, including the About page settings column; it is safe to rerun.
5. Run `supabase/sales-04-ledger.sql` to enable the cloud-backed Sales ledger, Sales-only user access, customer and payment history, sales settings, and secure workspace drafts. Run it after the admin and catalog scripts; it is safe to rerun.
6. Run `supabase/sales-05-editing.sql` after the Sales ledger script to enable the current admin sales editing and deletion behavior. This script is safe to rerun.
7. Run `supabase/inventory-06-dashboard.sql` after the Sales scripts to add admin-managed stock, atomic stock deductions/restocks, and aggregated Sales dashboard metrics. Existing products start with stock set to `0`; set accurate quantities in the admin UI before recording sales. This script is safe to rerun.
8. Run `supabase/products-07-seed.sql` to insert the current product details. Seeded products start without photos; upload their photos from the admin page.
9. In Supabase Authentication, create your account. Do not enable public sign-ups.
10. In Authentication → Users, copy your account's UUID. In the SQL Editor, assign that account admin access:

   ```sql
   insert into public.admin_users (user_id)
   values ('YOUR_AUTH_USER_UUID');
   ```

11. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings. Restart Vite.
12. Visit `/#admin`, sign in with the account you created, and manage products. Create, rename, reorder, or delete main sections and subsections from the Products page, and optionally group subsections under a main section. Manage hero pill text and destinations, and upload or replace the store logo there too. New photos and the logo upload to the `product-images` Storage bucket.
13. Open `/#petify-dashboard` to use the Sales board (or `/petify-dashboard` on hosts configured with SPA path fallback). Admins and assigned Sales users can sign in; administrators can also open it from the admin navigation. Configure Sales access and invoice settings under **Admin → Site settings → Sales settings**.
14. To add multi-size or multi-quantity products, edit a product, enable **This product has purchasable varieties with different prices**, then add an option label and its price for each size/pack (for example, `250 g`, `500 g`, and `1 kg`). Prices can be entered with or without thousands separators (for example, `1,299`); they are stored as numbers and displayed with Indian currency formatting. Each option gets its own formatted price on the storefront and is included in WhatsApp order messages and Sales invoices.
15. Admin and Sales sessions automatically sign out after 10 hours from sign-in. For server-enforced session expiration (including API access outside this UI), set the Supabase Auth session time-box to 10 hours in the project's Auth settings. The app also enforces the 10-hour limit in open and reopened dashboard tabs.

Only the public anon key belongs in this frontend. Never put a service-role key in a `VITE_` variable. Visitors can read active products; catalog writes require the assigned admin role. Sales access requires either the admin role or an explicitly assigned Sales role.

## Standalone Storekeeping workspace

Storekeeping is a separate private workspace at `/#store-keeping`; it does not reuse the storefront or admin routes, tables, roles, or Storage bucket. It uses Supabase Auth accounts and creates a profile in `petify_storekeeping_users` on first sign-in. New Storekeeping registrations require email sign-up to be enabled in Supabase Auth and the callback URL `https://YOUR_SITE/#store-keeping` to be on the Auth redirect allow list. Storekeeping users do not receive the existing `admin_users` or `sales_users` roles.

Run these three SQL scripts in the Supabase SQL Editor, in order. They are independent of the numbered storefront/Sales SQL setup above:

1. `supabase/storekeeping-01-schema.sql` creates the prefixed data tables, edit history, and atomic stock/sale functions.
2. `supabase/storekeeping-02-security.sql` enables owner-only RLS and grants access to the authenticated user’s own records.
3. `supabase/storekeeping-03-storage.sql` creates a private proof bucket with per-user file policies.

The app code is isolated in `src/features/storekeeping/`. It includes a dashboard, stock, sales, expenses, reports, settings and Auth screens. Reports use a browser-generated, paginated PDF; proof images are compressed and included in the appendix, and attached PDFs are appended as pages. Client-side report text is rendered through the browser so its installed fonts can display non-English content. Money is stored as Postgres `numeric` and aggregated in integer cents in report calculations. The database sale functions lock stock rows and reject overselling.

### Storekeeping manual test checklist

- [ ] Open `/#store-keeping`; confirm the existing storefront, `/#admin`, and `/#petify-dashboard` remain unchanged.
- [ ] Sign up with email confirmation, return to `/#store-keeping`, and verify a separate business profile is created.
- [ ] Add a stock item with opening quantity, edit its prices/unit, add a purchase with a bill/photo, and make both positive and negative stock adjustments.
- [ ] Attempt to adjust stock below zero and confirm the database rejects it with a visible message.
- [ ] Record a sale, then edit and delete it; verify stock changes atomically and the undo restores the sale only when enough stock remains.
- [ ] Add/edit/delete/undo expenses with custom categories and bill photos; open, replace by delete-and-upload, and delete proof attachments.
- [ ] Generate daily, weekly, monthly and custom-range PDFs; vary summaries, detail sections, table columns, filters, header, page size, orientation, proof appendix and page numbers.
- [ ] Compare total sales, COGS, gross profit, expenses, net profit and stock spend against hand-calculated sample transactions; try decimal prices and quantities.
- [ ] Save and reload a report preset; download a full CSV backup; test print and Web Share or the download fallback.
- [ ] Repeat core workflows on a phone and desktop, check keyboard focus and tap target sizes, and confirm one user's data/files are not visible to another account.

The storefront has a client-side cart for combining priced products and variants into one WhatsApp order request; each product can still be ordered directly from its card. Cart contents last only for the current page session and are not saved as a data source. There is no checkout/order database or storefront inventory/stock tracking; availability, shipping, and payment are confirmed by the team over WhatsApp. Edit the About page's introduction, mission, vision, and team description in **Admin → Site settings → Store content → About page**.

## Future mobile app

The React UI is kept separate from catalog access: `src/services/catalog.js` owns the web data source and the database is the shared contract. A future Expo/React Native app can use the same Supabase project, table, policies, and product fields with its own native UI. Move shared data mapping/types into a small shared package if both clients need identical client-side logic.

## Frontend structure

- `src/features/storefront/` contains storefront components and the catalog hook.
- `src/features/admin/auth/` contains admin sign-in.
- `src/features/admin/products/` contains product editing and product form utilities.
- `src/features/admin/` contains product management, site settings, and the collapsible admin workspace sidebar. Admin menu option definitions live in `adminNavigation.js`, separate from the reusable `WorkspaceSidebar.jsx` renderer.
- `src/features/sales/` contains the Sales portal, dashboard, settings, and feature styles.
- `src/features/storekeeping/` contains the isolated Storekeeping workspace and data service.
- `src/services/` contains Supabase access grouped by catalog, admin, and sales.
- `src/lib/` contains shared Supabase and product-pricing utilities.

Admin, sign-in, sales, site settings, product editing, and Storekeeping are lazy-loaded as separate chunks; storefront users do not need to download those workspaces.

## Admin shared components

Shared admin UI lives in `src/features/admin/components/`; session and confirmation hooks live in `src/hooks/`. Examples:

```jsx
import AdminButton from "./components/AdminButton.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminState from "./components/AdminState.jsx";

<AdminButton variant="primary" type="submit" disabled={saving}>
  {saving ? "Saving..." : "Save"}
</AdminButton>
{error && <AdminNotice kind="error">{error}</AdminNotice>}
{loading && <AdminState kind="loading" description="Loading products..." />}
```

For a destructive action, call `useConfirmDialog()` and render its dialog once in the component:

```jsx
import useConfirmDialog from "../../hooks/useConfirmDialog.js";
import ConfirmDialog from "./components/ConfirmDialog.jsx";

const { confirm, dialogProps } = useConfirmDialog();

async function removeItem() {
  if (!await confirm({ title: "Delete this item?", confirmLabel: "Delete" })) return;
  await deleteItem();
}

<ConfirmDialog {...dialogProps} />
```

`ImageUploadField` forwards selected files to `onChange(files)` and can optionally limit file size:

```jsx
<ImageUploadField
  label="Product photos"
  multiple
  maxSizeBytes={5 * 1024 * 1024}
  onChange={(files) => setSelectedFiles(files)}
/>
```

`useWorkspaceSession()` shares Supabase session restoration and expiration handling; role authorization remains explicit at each entry point and protected data remains enforced by RLS.

## Build

Run `npm run build` for the production bundle and `npm run preview` to inspect it locally.
