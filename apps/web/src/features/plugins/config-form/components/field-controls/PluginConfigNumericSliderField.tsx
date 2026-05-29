import { useEffect, useState } from "react";
import { Input, Slider } from "@heroui/react";

import type { PluginConfigFieldDefinition } from "../../types";

const sliderWrapClassName =
  "grid gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-3";

type NumericRangeConfig = {
  max: number;
  min: number;
  step: number;
};

type PluginConfigNumericSliderFieldProps = {
  definition: PluginConfigFieldDefinition;
  numericRange: NumericRangeConfig;
  onChange: (path: string, nextValue: string) => void;
  value: string;
};

export function PluginConfigNumericSliderField({
  definition,
  numericRange,
  onChange,
  value,
}: PluginConfigNumericSliderFieldProps) {
  const [inputDraftValue, setInputDraftValue] = useState(value);
  const [sliderInstanceKey, setSliderInstanceKey] = useState(() =>
    `${definition.path}:${value}`,
  );
  const committedSliderValue = coerceSliderValue(value, numericRange);

  useEffect(() => {
    setInputDraftValue(value);
    setSliderInstanceKey(`${definition.path}:${value}`);
  }, [committedSliderValue, definition.path, value]);

  return (
    <div className={sliderWrapClassName}>
      <Slider
        aria-label={`${definition.label} 滑块`}
        defaultValue={committedSliderValue}
        key={sliderInstanceKey}
        maxValue={numericRange.max}
        minValue={numericRange.min}
        onChange={(nextValue) => {
          // 保持 Slider 非受控，让 HeroUI 内部状态处理拖拽，避免受控回流打断动画帧。
          setInputDraftValue(
            formatSliderValue(
              definition,
              Number(nextValue),
              numericRange.step,
            ),
          );
        }}
        onChangeEnd={(nextValue) => {
          const nextNumericValue = Number(nextValue);
          const nextFormattedValue = formatSliderValue(
            definition,
            nextNumericValue,
            numericRange.step,
          );
          setInputDraftValue(nextFormattedValue);
          onChange(definition.path, nextFormattedValue);
        }}
        step={numericRange.step}
      >
        <Slider.Output />
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <Input
        aria-label={definition.label}
        className="w-full"
        fullWidth
        inputMode={definition.type === "integer" ? "numeric" : "decimal"}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputDraftValue(nextValue);
          onChange(definition.path, nextValue);
        }}
        placeholder={
          definition.placeholder ??
          `${numericRange.min} - ${numericRange.max}`
        }
        type="text"
        value={inputDraftValue}
        variant="primary"
      />
    </div>
  );
}

function coerceSliderValue(value: string, range: NumericRangeConfig): number {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return range.min;
  }

  if (numericValue < range.min) {
    return range.min;
  }

  if (numericValue > range.max) {
    return range.max;
  }

  return numericValue;
}

function formatSliderValue(
  definition: PluginConfigFieldDefinition,
  value: number,
  step: number,
): string {
  if (definition.type === "integer") {
    return String(Math.round(value));
  }

  const decimals = countDecimals(step);
  return value.toFixed(decimals);
}

function countDecimals(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value.toString().toLowerCase();

  if (normalized.includes("e-")) {
    const [, exponent] = normalized.split("e-");
    return Number(exponent);
  }

  const [, fraction = ""] = normalized.split(".");
  return fraction.length;
}
