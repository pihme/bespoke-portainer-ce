import { describe, it, expect, vi, beforeEach } from 'vitest';

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@/react/docker/stacks/view-models/external-stack', () => ({
  ExternalStackViewModel: class ExternalStackViewModel {
    constructor(name, type, creationDate) {
      this.Name = name;
      this.Type = type;
      this.CreationDate = creationDate;
      this.External = true;
    }
  },
}));

vi.mock('@/react/docker/stacks/common/stackYamlValidation', () => ({
  validateYAML: vi.fn(() => 'yaml-ok'),
}));

await import('./stackHelper.js');

function stackHelper() {
  return factoryState.factory();
}

describe('REQ-STK-01 StackHelper external compose stacks from containers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getExternalStacksFromContainers builds unique compose stacks from project labels', () => {
    const helper = stackHelper();
    const stacks = helper.getExternalStacksFromContainers([
      { Labels: { 'com.docker.compose.project': 'web' }, Created: 100 },
      { Labels: { 'com.docker.compose.project': 'web' }, Created: 200 },
      { Labels: { 'com.docker.compose.project': 'db' }, Created: 50 },
      { Labels: {}, Created: 1 },
      { Created: 2 },
    ]);

    expect(stacks).toHaveLength(2);
    expect(stacks.map((s) => s.Name).sort()).toEqual(['db', 'web']);
    expect(stacks.every((s) => s.Type === 2 && s.External === true)).toBe(true);
  });

  it('getExternalStacksFromContainers returns an empty list when nothing is labeled', () => {
    const helper = stackHelper();
    expect(helper.getExternalStacksFromContainers([{ Labels: null }, {}])).toEqual([]);
  });

  it('exposes validateYAML from the compose YAML validator', async () => {
    const { validateYAML } = await import('@/react/docker/stacks/common/stackYamlValidation');
    const helper = stackHelper();
    expect(helper.validateYAML('services:\n  a:\n    image: nginx')).toBe('yaml-ok');
    expect(validateYAML).toHaveBeenCalled();
  });
});
