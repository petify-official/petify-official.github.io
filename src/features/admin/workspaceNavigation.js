export function salesSectionHref(section = "sales-dashboard") {
  return `/#petify-dashboard/${section}`;
}

export function createSalesNavigationItem({ active = false, expanded = false } = {}) {
  return {
    id: "sales",
    label: "Sales",
    icon: "sales",
    active,
    expanded,
    href: salesSectionHref(),
    children: [
      { id: "sales-overview", label: "Overview", icon: "overview", href: salesSectionHref("sales-dashboard") },
      { id: "sales-create", label: "Create a sale", icon: "create", href: salesSectionHref("sales-create") },
      { id: "sales-history", label: "Sales history", icon: "history", href: salesSectionHref("sales-history") },
    ],
  };
}
