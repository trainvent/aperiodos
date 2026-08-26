import { useRef } from "react";
import { useTranslation } from "react-i18next";

const CSS_COLOR_OPTIONS = [
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black",
  "blanchedalmond", "blue", "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse",
  "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan",
  "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkkhaki", "darkmagenta",
  "darkolivegreen", "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
  "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise", "darkviolet", "deeppink",
  "deepskyblue", "dimgray", "dimgrey", "dodgerblue", "firebrick", "floralwhite", "forestgreen",
  "fuchsia", "gainsboro", "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow",
  "grey", "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender",
  "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral", "lightcyan",
  "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey", "lightpink", "lightsalmon",
  "lightseagreen", "lightskyblue", "lightslategray", "lightslategrey", "lightsteelblue",
  "lightyellow", "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine",
  "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue",
  "mediumspringgreen", "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream",
  "mistyrose", "moccasin", "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange",
  "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise", "palevioletred",
  "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue", "purple", "rebeccapurple",
  "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen",
  "seashell", "sienna", "silver", "skyblue", "slateblue", "slategray", "slategrey", "snow",
  "springgreen", "steelblue", "tan", "teal", "thistle", "tomato", "transparent", "turquoise",
  "violet", "wheat", "white", "whitesmoke", "yellow", "yellowgreen"
];

export function NumberField({
  values,
  setValues,
  name,
  label,
  min,
  max,
  step,
  full = false,
  placeholder,
  disabled = false,
}) {
  return (
    <label className={full ? "full" : ""}>
      <span>{label}</span>
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        step={step}
        value={values[name]}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
      />
    </label>
  );
}

export function TextField({ values, setValues, name, label, placeholder, full = false }) {
  return (
    <label className={full ? "full" : ""}>
      <span>{label}</span>
      <input
        name={name}
        type="text"
        placeholder={placeholder}
        value={values[name]}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
      />
    </label>
  );
}

export function ColorField({ values, setValues, name, label, placeholder, full = false, disabled = false }) {
  const { t } = useTranslation("common");
  const listId = `color-options-${name}`;
  const colorValue = String(values[name] ?? "").trim();
  const hasNoColor = !colorValue || colorValue.toLowerCase() === "none" || colorValue.toLowerCase() === "transparent";
  const cachedValueRef = useRef("");
  const autoClearedRef = useRef(false);
  const resolvedPlaceholder = placeholder || t("generator.common.colorPlaceholder");

  function handleFocus() {
    const currentValue = String(values[name] ?? "");
    cachedValueRef.current = currentValue;
    if (!currentValue) {
      autoClearedRef.current = false;
      return;
    }
    autoClearedRef.current = true;
    setValues((current) => ({ ...current, [name]: "" }));
  }

  function handleBlur() {
    const currentValue = String(values[name] ?? "").trim();
    if (autoClearedRef.current && !currentValue) {
      const restored = cachedValueRef.current;
      setValues((current) => ({ ...current, [name]: restored }));
    }
    autoClearedRef.current = false;
  }

  return (
    <label className={full ? "full color-field" : "color-field"}>
      <span>{label}</span>
      <div className="color-input-wrap">
        <span
          className={`color-chip${hasNoColor ? " color-chip-none" : ""}`}
          style={hasNoColor ? undefined : { background: values[name] }}
          aria-hidden="true"
        />
        <input
          name={name}
          type="text"
          list={listId}
          disabled={disabled}
          placeholder={resolvedPlaceholder}
          value={values[name]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
        />
        <datalist id={listId}>
          <option value="none" label={t("generator.common.noColor")} />
          {CSS_COLOR_OPTIONS.map((color) => (
            <option key={color} value={color} />
          ))}
        </datalist>
      </div>
    </label>
  );
}

export function SelectField({ values, setValues, name, label, options, full = false, disabled = false }) {
  return (
    <label className={full ? "full" : ""}>
      <span>{label}</span>
      <select
        name={name}
        value={values[name]}
        disabled={disabled}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({ values, setValues, name, label }) {
  return (
    <label className="checkbox">
      <input
        name={name}
        type="checkbox"
        checked={Boolean(values[name])}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.checked }))}
      />
      <span>{label}</span>
    </label>
  );
}
