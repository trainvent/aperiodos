import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "aperiodos-generator-walkthrough-v1";

export default function GeneratorWalkthrough({ settingsRef, previewRef, renderRef }) {
  const { t } = useTranslation("common");
  const [step, setStep] = useState(null);
  const [rect, setRect] = useState(null);
  const names = ["settings", "preview", "render"];
  const targetRef = [settingsRef, previewRef, renderRef][step];

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      // The walkthrough remains available without persistent storage.
    }
    setStep(0);
  }, []);

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // It can still be dismissed for this visit.
    }
    setStep(null);
    setRect(null);
  }

  useEffect(() => {
    if (step === null || !targetRef?.current) return undefined;
    const target = targetRef.current;
    const scrollTarget = () => target.scrollIntoView({ block: step === 0 ? "start" : "center", behavior: "instant" });
    scrollTarget();
    const measure = () => {
      const bounds = target.getBoundingClientRect();
      setRect({ left: bounds.left - 8, top: bounds.top - 8, width: bounds.width + 16, height: bounds.height + 16 });
    };
    measure();
    const frame = window.requestAnimationFrame(() => {
      scrollTarget();
      measure();
    });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const keyboard = (event) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", keyboard);
    };
  }, [step, targetRef]);

  if (step === null || !rect) return null;
  const advance = () => step === 2 ? finish() : setStep(step + 1);
  const width = Math.min(300, window.innerWidth - 32);
  const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
  const above = rect.top > 250;
  const bubbleStyle = {
    width,
    left,
    ...(above ? { bottom: window.innerHeight - rect.top + 14 } : { top: rect.top + rect.height + 14 }),
    "--tour-arrow-left": `${Math.max(20, Math.min(rect.left + rect.width / 2 - left, width - 36))}px`,
  };
  if (step === 0) {
    // Keep the explanation visible even when the settings box is taller than the screen.
    delete bubbleStyle.bottom;
    bubbleStyle.top = Math.max(24, Math.min(rect.top + 40, window.innerHeight - 240));
    if (rect.left + rect.width + width + 32 <= window.innerWidth) {
      bubbleStyle.left = rect.left + rect.width + 20;
    }
  }

  return createPortal(
    <div className="generator-tour" role="dialog" aria-modal="true" aria-label={t("generator.walkthrough.title")} onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const buttons = event.currentTarget.querySelectorAll("button");
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }}>
      <div className="generator-tour-highlight" style={rect} />
      <button className="generator-tour-surface" type="button" onClick={advance} aria-label={t("generator.walkthrough.continue")} autoFocus />
      <button className="generator-tour-continue" type="button" onClick={advance}>
        {t(step === 2 ? "generator.walkthrough.finish" : "generator.walkthrough.continue")}
      </button>
      <div className={`generator-tour-card ${step === 0 ? "tour-settings" : above ? "tour-above" : "tour-below"}`} style={bubbleStyle} aria-live="polite" onClick={advance}>
        <span className="generator-tour-progress">{step + 1} / 3</span>
        <h2>{t(`generator.walkthrough.${names[step]}.title`)}</h2>
        <p>{t(`generator.walkthrough.${names[step]}.body`)}</p>
        <div className="generator-tour-actions">
          <button type="button" onClick={(event) => { event.stopPropagation(); finish(); }}>{t("generator.walkthrough.skip")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
