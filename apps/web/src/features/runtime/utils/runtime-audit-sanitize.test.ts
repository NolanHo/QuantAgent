import { describe, expect, it } from 'vitest';

import { sanitizeRuntimeAuditDetails } from './runtime-audit-sanitize';

describe('sanitizeRuntimeAuditDetails', () => {
  it('redacts unsafe runtime audit keys recursively', () => {
    const sanitized = sanitizeRuntimeAuditDetails({
      provider_raw_response: 'raw-json',
      routing: {
        target_topics: ['hbm'],
        secret_token: 'token',
      },
      safe_summary: 'route accepted',
    });

    expect(sanitized).toEqual({
      provider_raw_response: '[已脱敏]',
      routing: {
        target_topics: ['hbm'],
        secret_token: '[已脱敏]',
      },
      safe_summary: 'route accepted',
    });
  });

  it('redacts prompt and token-like fields inside output payloads', () => {
    const sanitized = sanitizeRuntimeAuditDetails({
      reasoning_prompt: 'system prompt body',
      audit: {
        provider_raw_response: 'raw text',
        request_token: 'token-123',
      },
    });

    expect(sanitized).toEqual({
      reasoning_prompt: '[已脱敏]',
      audit: {
        provider_raw_response: '[已脱敏]',
        request_token: '[已脱敏]',
      },
    });
  });
});
