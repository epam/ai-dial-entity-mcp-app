import { describe, expect, test } from 'vitest';
import { readInboundCorrelation } from './http.ts';

describe('readInboundCorrelation', () => {
  test('reuses an inbound x-correlation-id rather than replacing it', () => {
    const correlation = readInboundCorrelation({
      'x-correlation-id': 'given-correlation-id',
    });
    expect(correlation.correlationId).toBe('given-correlation-id');
  });

  test('falls back to x-request-id when x-correlation-id is absent', () => {
    const correlation = readInboundCorrelation({
      'x-request-id': 'given-request-id',
    });
    expect(correlation.correlationId).toBe('given-request-id');
    expect(correlation.requestId).toBe('given-request-id');
  });

  test('falls back to x-trace-id when neither x-correlation-id nor x-request-id is present', () => {
    const correlation = readInboundCorrelation({
      'x-trace-id': 'given-trace-id',
    });
    expect(correlation.correlationId).toBe('given-trace-id');
    expect(correlation.traceId).toBe('given-trace-id');
  });

  test('generates an id when none of the inbound headers are present', () => {
    const correlation = readInboundCorrelation({});
    expect(correlation.correlationId).toMatch(/[0-9a-f-]{36}/);
    expect(correlation.requestId).toBeUndefined();
    expect(correlation.traceId).toBeUndefined();
  });

  test('keeps x-request-id and x-trace-id even when x-correlation-id wins', () => {
    const correlation = readInboundCorrelation({
      'x-correlation-id': 'given-correlation-id',
      'x-request-id': 'given-request-id',
      'x-trace-id': 'given-trace-id',
    });
    expect(correlation.correlationId).toBe('given-correlation-id');
    expect(correlation.requestId).toBe('given-request-id');
    expect(correlation.traceId).toBe('given-trace-id');
  });
});
