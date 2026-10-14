import { useCallback, useEffect, useRef, useState } from "react";

export default function useConfirmDialog() {
  const [options, setOptions] = useState(null);
  const pendingResolve = useRef(null);

  const confirm = useCallback((nextOptions) => new Promise((resolve) => {
    pendingResolve.current?.(false);
    pendingResolve.current = resolve;
    setOptions(nextOptions);
  }), []);

  const close = useCallback((confirmed) => {
    pendingResolve.current?.(confirmed);
    pendingResolve.current = null;
    setOptions(null);
  }, []);
  const onConfirm = useCallback(() => close(true), [close]);
  const onCancel = useCallback(() => close(false), [close]);

  useEffect(() => () => pendingResolve.current?.(false), []);

  return {
    confirm,
    dialogProps: {
      ...options,
      open: Boolean(options),
      onConfirm,
      onCancel,
    },
  };
}
