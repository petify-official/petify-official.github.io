export function formatDate(value, options = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat("en-IN", options).format(new Date(value));
}

export function formatDateTime(value) {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" });
}
