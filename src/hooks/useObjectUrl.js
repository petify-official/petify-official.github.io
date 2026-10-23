import { useEffect, useState } from "react";

export default function useObjectUrl(file) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    const nextUrl = file ? URL.createObjectURL(file) : "";
    queueMicrotask(() => {
      if (active) setUrl(nextUrl);
    });
    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  return url;
}
