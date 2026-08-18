import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ColorField, NumberField, SelectField } from "../../components/forms/FormFields";
import { apiUrl } from "../../lib/api";
import { SPECTRE_DEFAULTS } from "./defaults";
import GeneratorLayout from "./GeneratorLayout";

export default function SpectrePage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(SPECTRE_DEFAULTS);
  return (
    <GeneratorLayout
      title={t("generator.spectre.title")}
      controls={
        <>
          <NumberField values={values} setValues={setValues} name="width" label={t("generator.common.width")} min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="height" label={t("generator.common.height")} min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="level" label={t("generator.common.level")} min={1} max={8} />
          <NumberField values={values} setValues={setValues} name="scale" label={t("generator.common.scale")} min={1} max={120} />
          <NumberField values={values} setValues={setValues} name="center_x" label={t("generator.common.centerX")} step="0.1" />
          <NumberField values={values} setValues={setValues} name="center_y" label={t("generator.common.centerY")} step="0.1" />
          <div className="field-pair full">
            <SelectField
              values={values}
              setValues={setValues}
              name="format"
              label={t("generator.common.format")}
              options={[
                { value: "svg", label: "SVG" },
                { value: "png", label: "PNG" },
                { value: "jpg", label: "JPG" }
              ]}
            />
            <NumberField values={values} setValues={setValues} name="stroke_width" label={t("generator.common.strokeWidth")} min={0} max={20} step="0.1" />
          </div>
          <div className="field-pair full">
            <SelectField
              values={values}
              setValues={setValues}
              name="draw_mode"
              label={t("generator.spectre.drawMode")}
              options={[
                { value: "generated", label: t("generator.spectre.drawModeBuild") },
                { value: "translation", label: t("generator.spectre.drawModeTranslation") }
              ]}
            />
            <SelectField
              values={values}
              setValues={setValues}
              name="shape"
              label={t("generator.spectre.shape")}
              options={[
                { value: "straight", label: t("generator.spectre.shapeStraight") },
                { value: "curved", label: t("generator.spectre.shapeCurved") }
              ]}
            />
          </div>
          <div className="field-pair full">
            <ColorField values={values} setValues={setValues} name="background" label={t("generator.common.background")} />
            <ColorField values={values} setValues={setValues} name="outline" label={t("generator.common.outline")} />
          </div>
          <div className="swatches full">
            <ColorField values={values} setValues={setValues} name="palette_1" label={t("generator.common.color1")} />
            <ColorField values={values} setValues={setValues} name="palette_2" label={t("generator.common.color2")} />
            <ColorField values={values} setValues={setValues} name="palette_3" label={t("generator.common.color3")} />
            <ColorField values={values} setValues={setValues} name="palette_4" label={t("generator.common.color4")} />
          </div>
        </>
      }
      payload={() => ({
        width: Number(values.width),
        height: Number(values.height),
        level: Number(values.level),
        scale: Number(values.scale),
        center_x: Number(values.center_x),
        center_y: Number(values.center_y),
        format: values.format,
        draw_mode: values.draw_mode,
        shape: values.shape,
        background: values.background,
        outline: values.outline,
        stroke_width: Number(values.stroke_width),
        palette: [values.palette_1, values.palette_2, values.palette_3, values.palette_4]
          .map((value) => String(value).trim())
          .filter(Boolean)
      })}
      endpoint={apiUrl("/api/spectre/render")}
      downloadName={(payload) => `spectre.${payload.format}`}
      previewType={(payload) => {
        if (payload.format === "png") {
          return "image/png";
        }
        if (payload.format === "jpg") {
          return "image/jpeg";
        }
        return "image/svg+xml";
      }}
      values={values}
      setValues={setValues}
      defaults={SPECTRE_DEFAULTS}
    />
  );
}
