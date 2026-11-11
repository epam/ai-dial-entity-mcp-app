import { metrics } from '@opentelemetry/api';
import { describe, expect, test, vi } from 'vitest';
import {
  McpOutcome,
  createProbe,
  labelMcpRequest,
  observeMcpRequest,
  recordCoreCall,
  resolveOutcome,
} from './mcp-metrics.ts';

const KNOWN = new Set(['find_entities', 'show_entity_card']);
const call = (name: unknown) => ({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name },
});

describe('labelMcpRequest', () => {
  test('labels a known method without a tool', () => {
    expect(
      labelMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, KNOWN),
    ).toEqual({ method: 'tools/list', tool: 'none' });
  });

  test('labels a call to a registered tool by its name', () => {
    expect(labelMcpRequest(call('find_entities'), KNOWN)).toEqual({
      method: 'tools/call',
      tool: 'find_entities',
    });
  });

  test.each(['evil-123', '', 'FIND_ENTITIES', 42, null, undefined])(
    'labels the unregistered tool name %j unknown',
    (name) => {
      expect(labelMcpRequest(call(name), KNOWN).tool).toBe('unknown');
    },
  );

  test('labels a method the client made up unknown', () => {
    expect(
      labelMcpRequest({ jsonrpc: '2.0', id: 1, method: 'x'.repeat(500) }, KNOWN)
        .method,
    ).toBe('unknown');
  });

  test.each([undefined, null, 'text', 7, {}, { method: 5 }])(
    'labels the non-request body %j unknown',
    (body) => {
      expect(labelMcpRequest(body, KNOWN)).toEqual({
        method: 'unknown',
        tool: 'none',
      });
    },
  );

  test('labels a batch without reading its messages', () => {
    expect(labelMcpRequest([call('find_entities')], KNOWN)).toEqual({
      method: 'batch',
      tool: 'none',
    });
  });
});

describe('resolveOutcome', () => {
  const tool = { method: 'tools/call', tool: 'find_entities' };
  const list = { method: 'tools/list', tool: 'none' };

  test('a 401 is unauthorized', () => {
    expect(resolveOutcome(tool, createProbe(), 401, true)).toBe(
      McpOutcome.Unauthorized,
    );
  });

  test('a non-tool method that is answered is ok', () => {
    expect(resolveOutcome(list, createProbe(), 200, true)).toBe(McpOutcome.Ok);
  });

  test('a tool that ran and succeeded is ok', () => {
    const probe = { toolCalled: true, toolFailed: false };
    expect(resolveOutcome(tool, probe, 200, true)).toBe(McpOutcome.Ok);
  });

  test('a tool that ran and returned an error result is tool_error', () => {
    const probe = { toolCalled: true, toolFailed: true };
    expect(resolveOutcome(tool, probe, 200, true)).toBe(McpOutcome.ToolError);
  });

  test('a tools/call that never reached a handler is an error', () => {
    expect(resolveOutcome(tool, createProbe(), 200, true)).toBe(
      McpOutcome.Error,
    );
  });

  test.each([400, 413, 500])('HTTP %i is an error', (status) => {
    expect(resolveOutcome(list, createProbe(), status, true)).toBe(
      McpOutcome.Error,
    );
  });

  test('a response cut off before it was written is an error', () => {
    expect(resolveOutcome(list, createProbe(), 200, false)).toBe(
      McpOutcome.Error,
    );
  });

  test('an unknown method is an error', () => {
    expect(
      resolveOutcome(
        { method: 'unknown', tool: 'none' },
        createProbe(),
        200,
        true,
      ),
    ).toBe(McpOutcome.Error);
  });
});

describe('a failing telemetry backend', () => {
  test('never throws into the request path', () => {
    vi.spyOn(metrics, 'getMeter').mockImplementation(() => {
      throw new Error('meter exploded');
    });
    const observation = observeMcpRequest(KNOWN);
    expect(() => observation.setBody(call('find_entities'))).not.toThrow();
    expect(() => observation.finishResponse(200, true)).not.toThrow();
    expect(() => recordCoreCall(0.1, 'ok')).not.toThrow();
    vi.restoreAllMocks();
  });
});
