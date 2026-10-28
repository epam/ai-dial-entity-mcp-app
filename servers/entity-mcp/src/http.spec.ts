import { describe, expect, test } from 'vitest';
import type { ServerResponse } from 'node:http';
import { readInboundCorrelation, rejectUnauthenticated } from './http.ts';

const fakeResponse = () => {
  const calls: {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
  } = {};
  const res = {
    writeHead(status: number, headers: Record<string, string>) {
      calls.status = status;
      calls.headers = headers;
      return res;
    },
    end(body: string) {
      calls.body = body;
      return res;
    },
  };
  return { res: res as unknown as ServerResponse, calls };
};

describe('rejectUnauthenticated', () => {
  test('answers 401 with a Bearer challenge when no credential was forwarded', () => {
    const { res, calls } = fakeResponse();
    expect(rejectUnauthenticated(undefined, res)).toBe(true);
    expect(calls.status).toBe(401);
    expect(calls.headers?.['www-authenticate']).toBe('Bearer');
  });

  test('lets a request with a credential through without writing a response', () => {
    const { res, calls } = fakeResponse();
    expect(
      rejectUnauthenticated(
        { header: 'Authorization', value: 'Bearer t' },
        res,
      ),
    ).toBe(false);
    expect(calls.status).toBeUndefined();
  });
});

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
