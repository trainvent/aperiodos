import { useEffect, useState } from "react";

export default function HintPopup({ children, open, onDismiss, storageKey = "" }) {
  const [dismissed, setDismissed] = useState(Boolean(storageKey));

  useEffect(() => {
    if (!storageKey) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(window.localStorage.getItem(storageKey) === "true");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!open && !storageKey) setDismissed(false);
  }, [open, storageKey]);

  useEffect(() => {
    if (!open || dismissed) return undefined;
    const dismiss = () => {
      setDismissed(true);
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, "true");
        } catch {
          // The popup still dismisses for this page view when storage is unavailable.
        }
      }
      onDismiss?.();
    };
    document.addEventListener("pointerdown", dismiss, { once: true });
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [dismissed, onDismiss, open, storageKey]);

  if (!open || dismissed) return null;

  return (
    <div className="hint-popup" role="status">
      {children}
    </div>
  );
}
