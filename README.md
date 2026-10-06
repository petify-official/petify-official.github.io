# Petify Official

Petify's product catalog is a React + Vite web app. Products, sections, and all editable storefront content are loaded from Supabase. If Supabase is unavailable, the storefront shows an error instead of displaying stale local data. The browser does not use local storage as a data source.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Run `npm run dev` and open the URL Vite prints.

## Connect Supabase and enable the dashboards

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Run `supabase/admin.sql` to create the admin role, product write policies, and public image bucket.
4. Run `supabase/catalog-sections.sql` to add configurable storefront sections, section management permissions, and public store settings for brand, contact information, content, logo, hero navigation, and storefront visibility. Rerun this script after updates to apply later additions; it is safe to rerun.
5. Run `supabase/sales.sql` to create the cloud-backed Sales ledger, Sales-only user access, customer and payment history, unique invoice sequence, sales settings, product-variety support, and online delivery fields. Run it after `admin.sql` and `catalog-sections.sql`; it is safe to rerun. If sales were already installed, rerun this updated script to apply the latest Sales access and product/delivery updates.
6. Run `supabase/seed.sql` to insert the current product details. Seeded products start without photos; upload their photos from the admin page.
7. In Supabase Authentication, create your account. Do not enable public sign-ups.
8. In Authentication → Users, copy your account's UUID. In the SQL Editor, assign that account admin access:

   ```sql
   insert into public.admin_users (user_id)
   values ('YOUR_AUTH_USER_UUID');
   ```

9. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings. Restart Vite.
10. Visit `/#admin`, sign in with the account you created, and manage products. Create, rename, reorder, or delete empty storefront sections such as Toys or Cages from the Products page. Manage hero pill text and destinations, and upload or replace the store logo there too. New photos and the logo upload to the `product-images` Storage bucket.
11. Open `/#petify-dashboard` to use the standalone Sales portal (or `/petify-dashboard` on hosts configured with SPA path fallback). Admin accounts and assigned Sales-only accounts can sign in there; administrators can also open it from the admin sidebar. The Sales menu provides dashboard shortcuts to all users and administrator links to Sales settings and the full admin workspace. Sales-only accounts cannot manage products or site settings. The old `/#sales-dashb` link continues to open this portal. Create cloud-backed manual sales, invoices, and payment entries. Choose Online / delivery to record a delivery address, partner, tracking reference, delivery status, and delivery charge; the charge is included in the rounded invoice total.
12. To grant Sales-only access, create the user's account in Supabase Authentication, copy its UUID, then add that UUID under **Admin → Site settings → Sales settings → Sales-only accounts**. Admins can revoke access from the same place. Configure the sales module, invoice prefix, and default payment method there as well. The application does not expose public sign-up.
13. To add multi-size or multi-quantity products, edit a product, enable **This product has purchasable varieties with different prices**, then add an option label and its price for each size/pack (for example, `250 g`, `500 g`, and `1 kg`). Prices can be entered with or without thousands separators (for example, `1,299`); they are stored as numbers and displayed with Indian currency formatting. The existing product photos remain one shared image carousel. Each option gets its own formatted price on the storefront and is included in WhatsApp order messages and sales invoice items.
14. Rerun `supabase/sales.sql` to enable secure cloud drafts for product edits, site settings, and unfinished sales. Drafts are private to the signed-in user; unfinished sales do not create invoices until submitted.
15. Admin and Sales sessions automatically sign out after 10 hours from sign-in. For server-enforced session expiration (including API access outside this UI), set the Supabase Auth session time-box to 10 hours in the project's Auth settings. The app also enforces the 10-hour limit in open and reopened dashboard tabs.

Only the public anon key belongs in this frontend. Never put a service-role key in a `VITE_` variable. Visitors can read active products; catalog writes require the assigned admin role. Sales ledger access requires either the admin role or an explicitly assigned Sales role.

The existing storefront does not currently have a checkout/order database or inventory/stock fields; customer orders are initiated through WhatsApp. Online sales entered in the sales workspace are recorded manually by staff with their delivery details; storefront WhatsApp inquiries are not automatically recorded as completed online orders, and sales do not adjust nonexistent stock. When online checkout is added, it should write its orders into the same sales ledger or expose a shared order relationship rather than creating a parallel catalog.

## Future mobile app

The React UI is kept separate from catalog access: `src/services/catalog.js` owns the web data source and the database is the shared contract. A future Expo/React Native app can use the same Supabase project, table, policies, and product fields with its own native UI. Move shared data mapping/types into a small shared package if both clients need identical client-side logic.

## Frontend structure

- `src/features/storefront/` contains storefront components and the catalog hook.
- `src/features/admin/auth/` contains admin sign-in.
- `src/features/admin/products/` contains product editing and product form utilities.
- `src/features/admin/` contains the shared collapsible, icon-based workspace sidebar, admin workspace navigation, and site-settings screens. Sales navigation is configured once and shared between workspaces; choosing the Sales parent opens Overview, while its separate chevron expands the indented section links.
- `src/features/sales/` contains the standalone Sales portal, dashboard, settings, and feature styles.
- `src/services/` contains Supabase access grouped by catalog, admin, and sales.
- `src/lib/` contains shared Supabase and product-pricing utilities.

Admin, sign-in, sales, site settings, and product editing are lazy-loaded as separate chunks; storefront users do not need to download the admin workspace.

## Build

Run `npm run build` for the production bundle and `npm run preview` to inspect it locally.
