const noticeClasses = {
  error: "admin-error",
  success: "admin-success",
  info: "admin-info",
};

export default function AdminNotice({ kind = "info", className = "", children, role, as = "p" }) {
  if (!children) return null;

  const classes = [noticeClasses[kind] ?? noticeClasses.info, className].filter(Boolean).join(" ");
  const noticeRole = role ?? (kind === "error" ? "alert" : "status");

  const Notice = as;
  return <Notice className={classes} role={noticeRole}>{children}</Notice>;
}
