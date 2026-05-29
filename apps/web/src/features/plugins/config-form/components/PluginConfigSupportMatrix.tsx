import { Card, Chip, ListBox, Surface } from "@heroui/react";

import type {
  PluginConfigSchemaSnapshot,
  PluginConfigSupportLevel,
} from "../types/plugin-config.types";

type PluginConfigSupportMatrixProps = {
  description?: string;
  title?: string;
  supportMatrix: PluginConfigSchemaSnapshot["supportMatrix"];
};

export function PluginConfigSupportMatrix({
  description,
  title = "支持矩阵",
  supportMatrix,
}: PluginConfigSupportMatrixProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        {description ? (
          <Card.Description>{description}</Card.Description>
        ) : null}
      </Card.Header>

      <Card.Content>
        <ListBox aria-label="支持矩阵">
          {supportMatrix.map((entry) => (
            <ListBox.Item
              id={entry.feature}
              key={entry.feature}
              textValue={entry.feature}
            >
              <Surface variant="secondary">
                <div className="grid gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 text-sm font-bold text-slate-900">
                      {entry.feature}
                    </p>
                    <Chip
                      color={supportBadgeColor(entry.level)}
                      size="sm"
                      variant="soft"
                    >
                      {entry.level}
                    </Chip>
                  </div>
                  <p className="m-0 text-sm leading-6 text-slate-500">
                    {entry.note}
                  </p>
                </div>
              </Surface>
            </ListBox.Item>
          ))}
        </ListBox>
      </Card.Content>
    </Card>
  );
}

function supportBadgeColor(
  level: PluginConfigSupportLevel,
): "success" | "warning" | "danger" {
  if (level === "supported") {
    return "success";
  }

  if (level === "degraded") {
    return "warning";
  }

  return "danger";
}
