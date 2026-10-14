const variantClasses = {
  primary: "admin-primary-button",
  secondary: "admin-secondary-button",
  danger: "admin-delete-button",
  quiet: "admin-quiet-button",
};

export default function AdminButton({
  variant = "secondary",
  className = "",
  type = "button",
  children,
  ...props
}) {
  const classes = [variantClasses[variant] ?? variantClasses.secondary, className]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} type={type} {...props}>{children}</button>;
}
