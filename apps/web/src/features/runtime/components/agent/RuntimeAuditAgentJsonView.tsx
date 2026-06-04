import type { RuntimeAuditSafeValue } from '../../types';
import { sanitizeRuntimeAuditDetails } from '../../utils/runtime-audit-sanitize';

interface RuntimeAuditAgentJsonViewProps {
  value: Record<string, RuntimeAuditSafeValue> | null;
}

export function RuntimeAuditAgentJsonView({ value }: RuntimeAuditAgentJsonViewProps) {
  const sanitizedValue = sanitizeRuntimeAuditDetails(value);

  if (!sanitizedValue) {
    return (
      <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-body-sm text-muted">
        当前没有持久化结构化 output JSON。
      </div>
    );
  }

  return (
    <pre className="max-h-[26rem] overflow-auto rounded-lg border border-hairline bg-ink px-3 py-3 text-[12px] leading-5 text-canvas">
      {JSON.stringify(sanitizedValue, null, 2)}
    </pre>
  );
}
