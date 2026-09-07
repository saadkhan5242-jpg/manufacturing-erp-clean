import { useEffect, useMemo, useState } from "react";
import { ToastContext } from "./ToastContext.jsx";

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = (message, type = "error") => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 5000);
  };
  useEffect(() => {
    const handleError = (event) => toast(event.detail?.message || "A request failed");
    window.addEventListener("erp:error", handleError);
    return () => window.removeEventListener("erp:error", handleError);
  }, []);
  const value = useMemo(() => ({ toast, success: (message) => toast(message, "success"), error: (message) => toast(message, "error") }), []);
  return <ToastContext.Provider value={value}>{children}<div className="erp-toast-region" aria-live="polite">{toasts.map((item) => <div className={`erp-toast erp-toast-${item.type}`} key={item.id}>{item.message}</div>)}</div></ToastContext.Provider>;
}