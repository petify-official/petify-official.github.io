import { createSalesNavigationItem } from "./workspaceNavigation.js";

const adminMenuOptions = [
  { id: "products", label: "Products", icon: "products", view: "products" },
  { id: "settings", label: "Site settings", icon: "settings", view: "site-settings" },
];

export function createAdminNavigationItems(activeView, onSelect) {
  return [
    ...adminMenuOptions.map(({ view, ...item }) => ({
      ...item,
      active: activeView === view,
      onClick: () => onSelect(view),
    })),
    createSalesNavigationItem(),
  ];
}
