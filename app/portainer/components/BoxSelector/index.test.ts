import { beforeEach, describe, expect, it, vi } from 'vitest';

const { angularMock, moduleApi, components } = vi.hoisted(() => {
  const components: Array<{ name: string }> = [];
  const moduleApi = {
    component: vi.fn((name: string) => {
      components.push({ name });
      return moduleApi;
    }),
    name: 'app.portainer.component.box-selector',
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  return { angularMock, moduleApi, components };
});

vi.mock('angular', () => ({ default: angularMock }));
vi.mock('@/react-tools/react2angular', () => ({
  react2angular: () => ({}),
}));
vi.mock('@@/BoxSelector', () => ({ BoxSelector: () => null }));
vi.mock('./BoxSelectorAngular', () => ({ BoxSelectorAngular: {} }));

describe('boxSelectorModule', () => {
  beforeEach(() => {
    components.length = 0;
    angularMock.module.mockClear();
    moduleApi.component.mockClear();
  });

  it('registers react and angular box selector components', async () => {
    const mod = await import('./index');
    expect(angularMock.module).toHaveBeenCalledWith(
      'app.portainer.component.box-selector',
      []
    );
    expect(components.map((c) => c.name)).toEqual([
      'boxSelectorReact',
      'boxSelector',
    ]);
    expect(mod.buildOption).toBeTypeOf('function');
  });
});
