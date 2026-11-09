import { describe, expect, it } from 'vitest';

import { toStatusObject, toWorkflow } from './mappers';

describe('workflow query mappers', () => {
  it('maps missing status phases to unknown', () => {
    expect(toStatusObject(undefined)).toEqual({
      artifact: { status: 'unknown', error: undefined },
      source: { status: 'unknown', error: undefined },
      target: { status: 'unknown', error: undefined },
    });
  });

  it('maps a workflow and filters artifact files without sourceId', () => {
    const mapped = toWorkflow({
      id: 1,
      name: 'wf',
      status: {
        source: { status: 'healthy' },
        artifact: { status: 'error', error: 'bad yaml' },
        target: { status: 'syncing' },
      },
      artifacts: [
        {
          id: 10,
          type: 'stack',
          name: 'web',
          platform: 'dockerStandalone',
          status: {
            source: { status: 'healthy' },
            artifact: { status: 'healthy' },
            target: { status: 'healthy' },
          },
          files: [
            { sourceId: 5, path: 'compose.yml', ref: 'main' },
            { path: 'missing-source.yml', ref: 'main' } as never,
          ],
        },
      ],
    } as never);

    expect(mapped.status.artifact).toEqual({
      status: 'error',
      error: 'bad yaml',
    });
    expect(mapped.artifacts).toHaveLength(1);
    expect(mapped.artifacts[0].files).toEqual([
      { sourceId: 5, path: 'compose.yml', ref: 'main' },
    ]);
  });

  it('defaults artifacts to an empty list when omitted', () => {
    const mapped = toWorkflow({
      id: 2,
      name: 'empty',
      status: undefined,
      artifacts: undefined,
    } as never);
    expect(mapped.artifacts).toEqual([]);
    expect(mapped.status.source.status).toBe('unknown');
  });
});
