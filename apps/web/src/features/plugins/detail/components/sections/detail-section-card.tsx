import { Card } from "@heroui/react";
import type { ReactNode } from "react";

export function DetailSectionCard({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  description?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <Card className="border border-hairline bg-surface">
      <Card.Header>
        <div>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {eyebrow}
          </p>
          <Card.Title className="mt-1 text-title-sm font-bold text-ink">{title}</Card.Title>
          {description ? (
            <Card.Description className="mt-1 text-body-sm text-muted">
              {description}
            </Card.Description>
          ) : null}
        </div>
      </Card.Header>
      <Card.Content>{children}</Card.Content>
    </Card>
  );
}
