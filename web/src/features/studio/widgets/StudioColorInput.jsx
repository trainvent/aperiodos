import { useEffect, useRef } from "react";

export default function StudioColorInput({ value, onChange, ...props }) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.value = value || "#000000";
  }, [value]);

  useEffect(() => {
    const input = inputRef.current;
    const commit = () => onChange(input.value);
    // React's onChange also fires for every native input event while dragging.
    // Let the picker update its own swatch and commit only its native change.
    input.addEventListener("change", commit);
    return () => input.removeEventListener("change", commit);
  }, [onChange]);

  return <input {...props} ref={inputRef} type="color" defaultValue={value || "#000000"} />;
}
