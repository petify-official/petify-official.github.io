import { useId, useState } from "react";
import AdminNotice from "./AdminNotice.jsx";

export default function ImageUploadField({
  label,
  accept = "image/*",
  multiple = false,
  capture,
  disabled = false,
  hint,
  maxSizeBytes,
  className = "",
  onChange,
}) {
  const inputId = useId();
  const [error, setError] = useState("");

  function handleChange(event) {
    const selectedFiles = Array.from(event.target.files ?? []);
    const oversizedFile = maxSizeBytes
      ? selectedFiles.find((file) => file.size > maxSizeBytes)
      : null;

    if (oversizedFile) {
      setError(`${oversizedFile.name} exceeds the ${Math.ceil(maxSizeBytes / (1024 * 1024))} MB file-size limit.`);
      onChange?.([]);
      event.target.value = "";
      return;
    }

    setError("");
    onChange?.(selectedFiles);
    if (multiple) event.target.value = "";
  }

  return (
    <div className={`admin-image-upload-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        disabled={disabled}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        onChange={handleChange}
      />
      {hint && <span className="admin-field-hint" id={`${inputId}-hint`}>{hint}</span>}
      {error && <AdminNotice kind="error" className="admin-image-upload-error" role="alert">{error}</AdminNotice>}
    </div>
  );
}
