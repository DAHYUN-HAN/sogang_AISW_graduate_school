import { useCallback, useState } from "react";
import { nextToastState, type ToastState, type ToastVariant } from "../utils/toast";

// 화면마다 <Toast toast={toast} onHide={hideToast} />를 두고 이 훅으로 띄운다.
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const showToast = useCallback(
    (message: string, variant: ToastVariant = "error") => setToast((current) => nextToastState(current, message, variant)),
    [],
  );
  const hideToast = useCallback(() => setToast(null), []);
  return { toast, showToast, hideToast };
}
