import { useTranslation } from "react-i18next";

import { ColorField, NumberField, SelectField } from "../../components/forms/FormFields";

export function SettingsRow({ children }) {
  return <div className="field-pair full">{children}</div>;
}

export default function GeneratorSettingsScaffold({
  values,
  setValues,
  parameters,
  centerStep,
  allowSvg = true,
  modes,
  palette
}) {
  const { t } = useTranslation("common");
  const formatOptions = [
    ...(allowSvg ? [{ value: "svg", label: "SVG" }] : []),
    { value: "png", label: "PNG" },
    { value: "jpg", label: "JPG" }
  ];

  return (
    <>
      <SettingsRow>
        <NumberField values={values} setValues={setValues} name="width" label={t("generator.common.width")} min={64} max={6000} />
        <NumberField values={values} setValues={setValues} name="height" label={t("generator.common.height")} min={64} max={6000} />
      </SettingsRow>
      {parameters}
      {centerStep ? (
        <SettingsRow>
          <NumberField values={values} setValues={setValues} name="center_x" label={t("generator.common.centerX")} step={centerStep} />
          <NumberField values={values} setValues={setValues} name="center_y" label={t("generator.common.centerY")} step={centerStep} />
        </SettingsRow>
      ) : null}
      <SettingsRow>
        <SelectField
          values={values}
          setValues={setValues}
          name="format"
          label={t("generator.common.format")}
          options={formatOptions}
        />
        <NumberField
          values={values}
          setValues={setValues}
          name="stroke_width"
          label={t("generator.common.strokeWidth")}
          min={0}
          max={20}
          step="0.1"
        />
      </SettingsRow>
      {modes}
      <SettingsRow>
        <ColorField
          values={values}
          setValues={setValues}
          name="background"
          label={t("generator.common.background")}
        />
        <ColorField
          values={values}
          setValues={setValues}
          name="outline"
          label={t("generator.common.outline")}
        />
      </SettingsRow>
      <div className="swatches full">{palette}</div>
    </>
  );
}
