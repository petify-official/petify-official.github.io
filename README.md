# Petify Official

Petify's product catalog is a React + Vite web app. Products, sections, and all editable storefront content are loaded from Supabase. If Supabase is unavailable, the storefront shows an error instead of displaying stale local data. The browser does not use local storage as a data source.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Run `npm run dev` and open the URL Vite prints.

## Connect Supabase and enable admin product management

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Run `supabase/admin.sql` to create the admin role, product write policies, and public image bucket.
4. Run `supabase/catalog-sections.sql` to add configurable main sections and subsections, section management permissions, and public store settings for brand, contact information, content, logo, hero navigation, storefront visibility, and the editable footer version number. Subsections can be assigned to a main section or left standalone. Rerun this script after updates to apply later additions; it is safe to rerun.
5. Run `supabase/sales.sql` to enable the cloud-backed Sales ledger, Sales-only user access, customer and payment history, sales settings, and secure workspace drafts. Run it after `admin.sql` and `catalog-sections.sql`; it is safe to rerun.
6. Run `supabase/inventory-dashboard.sql` after `sales.sql` to add admin-managed stock, atomic stock deductions/restocks, and aggregated Sales dashboard metrics. Existing products start with stock set to `0`; set accurate quantities in the admin UI before recording sales. This script is safe to rerun.
7. Run `supabase/seed.sql` to insert the current product details. Seeded products start without photos; upload their photos from the admin page.
8. In Supabase Authentication, create your account. Do not enable public sign-ups.
9. In Authentication → Users, copy your account's UUID. In the SQL Editor, assign that account admin access:

   ```sql
   insert into public.admin_users (user_id)
   values ('YOUR_AUTH_USER_UUID');
   ```

9. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings. Restart Vite.
10. Visit `/#admin`, sign in with the account you created, and manage products. Create, rename, reorder, or delete main sections and subsections from the Products page, and optionally group subsections under a main section. Manage hero pill text and destinations, and upload or replace the store logo there too. New photos and the logo upload to the `product-images` Storage bucket.
11. Open `/#petify-dashboard` to use the Sales board (or `/petify-dashboard` on hosts configured with SPA path fallback). Admins and assigned Sales users can sign in; administrators can also open it from the admin navigation. Configure Sales access and invoice settings under **Admin → Site settings → Sales settings**.
12. To add multi-size or multi-quantity products, edit a product, enable **This product has purchasable varieties with different prices**, then add an option label and its price for each size/pack (for example, `250 g`, `500 g`, and `1 kg`). Prices can be entered with or without thousands separators (for example, `1,299`); they are stored as numbers and displayed with Indian currency formatting. Each option gets its own formatted price on the storefront and is included in WhatsApp order messages and Sales invoices.
13. Admin and Sales sessions automatically sign out after 10 hours from sign-in. For server-enforced session expiration (including API access outside this UI), set the Supabase Auth session time-box to 10 hours in the project's Auth settings. The app also enforces the 10-hour limit in open and reopened dashboard tabs.

Only the public anon key belongs in this frontend. Never put a service-role key in a `VITE_` variable. Visitors can read active products; catalog writes require the assigned admin role. Sales access requires either the admin role or an explicitly assigned Sales role.

The existing storefront does not currently have a checkout/order database or inventory/stock fields; customer orders are initiated through WhatsApp.

## Future mobile app

The React UI is kept separate from catalog access: `src/services/catalog.js` owns the web data source and the database is the shared contract. A future Expo/React Native app can use the same Supabase project, table, policies, and product fields with its own native UI. Move shared data mapping/types into a small shared package if both clients need identical client-side logic.

## Frontend structure

- `src/features/storefront/` contains storefront components and the catalog hook.
- `src/features/admin/auth/` contains admin sign-in.
- `src/features/admin/products/` contains product editing and product form utilities.
- `src/features/admin/` contains product management, site settings, and the collapsible admin workspace sidebar. Admin menu option definitions live in `adminNavigation.js`, separate from the reusable `WorkspaceSidebar.jsx` renderer.
- `src/features/sales/` contains the Sales portal, dashboard, settings, and feature styles.
- `src/services/` contains Supabase access grouped by catalog, admin, and sales.
- `src/lib/` contains shared Supabase and product-pricing utilities.

Admin, sign-in, sales, site settings, and product editing are lazy-loaded as separate chunks; storefront users do not need to download the admin workspace.

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
