import { createElement } from "react";

export default function AdminState({
  kind = "empty",
  title,
  description,
  action,
  className = "",
  as = "section",
  role,
  ...props
}) {
  const classes = ["admin-state", `admin-state-${kind}`, className].filter(Boolean).join(" ");

  return createElement(
    as,
    {
      className: classes,
      role: role ?? (kind === "loading" ? "status" : undefined),
      "aria-busy": kind === "loading" || undefined,
      ...props,
    },
    title && <strong>{title}</strong>,
    description && <p>{description}</p>,
    action,
  );
}
