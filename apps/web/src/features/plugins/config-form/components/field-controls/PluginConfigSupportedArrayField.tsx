import { memo, useMemo } from "react";
import { Button, Input, Popover } from "@heroui/react";
import { FiPlus, FiTrash2 } from "react-icons/fi";

import {
  joinArrayDraftValue,
  splitArrayDraftItems,
} from "../../utils/plugin-config-draft";
import type { PluginConfigFieldDefinition } from "../../types/plugin-config.types";

const arrayItemCardClassName =
  "grid gap-3 rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm";
const arrayEmptyToolbarClassName = "flex items-center justify-end";
const emptyChoiceOptions: string[] = [];

type ArrayPreviewPopoverProps = {
  actionLabel: string;
  addLabel: string;
  description: string;
  emptyActionLabel: string;
  onAddEmpty: () => void;
  onSelectOption: (option: string) => void;
  options: string[];
};

type PluginConfigSupportedArrayFieldProps = {
  definition: PluginConfigFieldDefinition;
  onChange: (path: string, nextValue: string) => void;
  value: string;
};

function ArrayPreviewPopover({
  actionLabel,
  addLabel,
  description,
  emptyActionLabel,
  onAddEmpty,
  onSelectOption,
  options,
}: ArrayPreviewPopoverProps) {
  if (options.length === 0) {
    return (
      <Button
        aria-label={actionLabel}
        isIconOnly
        onPress={onAddEmpty}
        size="sm"
        type="button"
        variant="ghost"
      >
        <FiPlus aria-hidden="true" className="text-[14px]" />
      </Button>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button
          aria-label={actionLabel}
          isIconOnly
          size="sm"
          type="button"
          variant="ghost"
        >
          <FiPlus aria-hidden="true" className="text-[14px]" />
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-[260px] p-0" placement="top end">
        <Popover.Dialog className="grid gap-2 p-3">
          <div className="grid gap-0.5 px-1">
            <Popover.Heading className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
              快捷添加
            </Popover.Heading>
            <p className="m-0 text-xs leading-5 text-slate-500">
              {description}
            </p>
          </div>
          <div className="grid gap-1">
            <Button
              aria-label={emptyActionLabel}
              fullWidth
              onPress={onAddEmpty}
              size="sm"
              type="button"
              variant="ghost"
            >
              <span className="flex w-full items-center justify-between">
                <span>添加空白项</span>
                <FiPlus
                  aria-hidden="true"
                  className="text-[13px] text-slate-400"
                />
              </span>
            </Button>
            {options.map((option) => (
              <Button
                key={option}
                aria-label={`${addLabel} ${option}`}
                fullWidth
                onPress={() => {
                  onSelectOption(option);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <span className="flex w-full items-center justify-between">
                  <span>{option}</span>
                  <FiPlus
                    aria-hidden="true"
                    className="text-[13px] text-sky-500"
                  />
                </span>
              </Button>
            ))}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

const MemoizedArrayPreviewPopover = memo(
  ArrayPreviewPopover,
  (previous, next) =>
    previous.actionLabel === next.actionLabel &&
    previous.addLabel === next.addLabel &&
    previous.description === next.description &&
    previous.emptyActionLabel === next.emptyActionLabel &&
    previous.onAddEmpty === next.onAddEmpty &&
    previous.onSelectOption === next.onSelectOption &&
    previous.options === next.options,
);

export function PluginConfigSupportedArrayField({
  definition,
  onChange,
  value,
}: PluginConfigSupportedArrayFieldProps) {
  const items = useMemo(() => splitArrayDraftItems(value), [value]);
  const selectedItems = useMemo(
    () => items.filter((item: string) => item.trim().length > 0),
    [items],
  );
  const availableChoices = definition.choiceOptions ?? emptyChoiceOptions;
  const previewChoices = useMemo(
    () =>
      availableChoices.filter((option) => !selectedItems.includes(option)),
    [availableChoices, selectedItems],
  );

  return (
    <div className="grid min-w-0 gap-2.5">
      {items.map((itemValue: string, index: number) => (
        <SupportedArrayItem
          key={`${definition.path}-${index}`}
          definition={definition}
          index={index}
          itemValue={itemValue}
          items={items}
          onChange={onChange}
          previewChoices={previewChoices}
        />
      ))}
      {items.length === 0 ? (
        <div className={arrayEmptyToolbarClassName}>
          <MemoizedArrayPreviewPopover
            actionLabel={`添加 ${definition.label} 项`}
            addLabel="添加推荐项"
            description="选择推荐项后，直接作为第一项写入。"
            emptyActionLabel={`添加 ${definition.label} 空白项`}
            onAddEmpty={() => {
              onChange(definition.path, joinArrayDraftValue([""]));
            }}
            onSelectOption={(option) => {
              onChange(definition.path, joinArrayDraftValue([option]));
            }}
            options={previewChoices}
          />
        </div>
      ) : null}
    </div>
  );
}

type SupportedArrayItemProps = {
  definition: PluginConfigFieldDefinition;
  index: number;
  itemValue: string;
  items: string[];
  onChange: (path: string, nextValue: string) => void;
  previewChoices: string[];
};

const SupportedArrayItem = memo(function SupportedArrayItem({
  definition,
  index,
  itemValue,
  items,
  onChange,
  previewChoices,
}: SupportedArrayItemProps) {
  return (
    <div className={arrayItemCardClassName}>
      <Input
        aria-label={`${definition.label} 第 ${index + 1} 项`}
        autoComplete={undefined}
        className="w-full"
        fullWidth
        onChange={(event) => {
          const nextItems = [...items];
          nextItems[index] = event.target.value;
          onChange(definition.path, joinArrayDraftValue(nextItems));
        }}
        placeholder={
          definition.placeholder ??
          definition.examples?.[0] ??
          `请输入第 ${index + 1} 项`
        }
        type="text"
        value={itemValue}
        variant="primary"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
          第 {index + 1} 项
        </span>
        <div className="flex items-center gap-2">
          <MemoizedArrayPreviewPopover
            actionLabel={`在 ${definition.label} 第 ${index + 1} 项后添加`}
            addLabel={`在 ${definition.label} 第 ${index + 1} 项后添加推荐项`}
            description="选择推荐项后，直接插入到当前项后面。"
            emptyActionLabel={`在 ${definition.label} 第 ${index + 1} 项后添加空白项`}
            onAddEmpty={() => {
              const nextItems = [...items];
              nextItems.splice(index + 1, 0, "");
              onChange(definition.path, joinArrayDraftValue(nextItems));
            }}
            onSelectOption={(option) => {
              const nextItems = [...items];
              nextItems.splice(index + 1, 0, option);
              onChange(definition.path, joinArrayDraftValue(nextItems));
            }}
            options={previewChoices}
          />
          <Button
            aria-label={`移除 ${definition.label} 第 ${index + 1} 项`}
            isIconOnly
            onPress={() => {
              const nextItems = items.filter(
                (_, itemIndex) => itemIndex !== index,
              );
              onChange(definition.path, joinArrayDraftValue(nextItems));
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <FiTrash2 aria-hidden="true" className="text-[14px]" />
          </Button>
        </div>
      </div>
    </div>
  );
});
