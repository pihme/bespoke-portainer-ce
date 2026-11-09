import { beforeAll, describe, expect, it, vi } from 'vitest';

const registries = { controller: null, component: null };

const angularStub = {
  module: () => ({
    controller: (_name, deps) => {
      registries.controller = deps[deps.length - 1];
      return { name: 'portainer.docker' };
    },
    component: (_name, def) => {
      registries.component = def;
      return { name: 'portainer.docker' };
    },
  }),
};

globalThis.angular = angularStub;

await import('./node-labels-table-controller.js');
await import('./node-labels-table.js');

describe('nodeLabelsTable', () => {
  beforeAll(() => {
    expect(registries.controller).toBeTypeOf('function');
    expect(registries.component).toBeTruthy();
  });

  it('registers the component bindings', () => {
    expect(registries.component.bindings).toEqual({
      labels: '<',
      onChangedLabels: '&',
    });
    expect(registries.component.controller).toBe('NodeLabelsTableController');
  });

  it('removeLabel splices and notifies when a label is removed', () => {
    const ctrl = {};
    registries.controller.call(ctrl);
    ctrl.labels = [
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ];
    ctrl.onChangedLabels = vi.fn();

    ctrl.removeLabel(0);
    expect(ctrl.labels).toEqual([{ key: 'b', value: '2' }]);
    expect(ctrl.onChangedLabels).toHaveBeenCalledWith({
      labels: [{ key: 'b', value: '2' }],
    });
  });

  it('updateLabel notifies only when key or value changed', () => {
    const ctrl = {};
    registries.controller.call(ctrl);
    ctrl.labels = [
      { key: 'a', value: '1', originalKey: 'a', originalValue: '1' },
    ];
    ctrl.onChangedLabels = vi.fn();

    ctrl.updateLabel(ctrl.labels[0]);
    expect(ctrl.onChangedLabels).not.toHaveBeenCalled();

    ctrl.labels[0].value = '2';
    ctrl.updateLabel(ctrl.labels[0]);
    expect(ctrl.onChangedLabels).toHaveBeenCalledWith({ labels: ctrl.labels });
  });
});
