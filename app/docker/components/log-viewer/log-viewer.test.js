import { describe, expect, it, vi } from 'vitest';

const { angularMock } = vi.hoisted(() => {
  const moduleApi = {
    component: vi.fn(() => moduleApi),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return { angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./log-viewer.js');

describe('logViewer angular component registration', () => {
  it('registers bindings for local container log viewing', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.docker');
    const config = angularMock.module.mock.results[0].value.component.mock.calls[0][1];
    expect(config.controller).toBe('LogViewerController');
    expect(config.bindings).toMatchObject({
      data: '=',
      displayTimestamps: '=',
      logCollectionChange: '<',
      sinceTimestamp: '=',
      lineCount: '=',
      resourceName: '<',
    });
  });
});
