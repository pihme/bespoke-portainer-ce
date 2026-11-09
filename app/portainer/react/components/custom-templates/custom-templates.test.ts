import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const component = vi.fn(function component() {
    return api;
  });
  const api = { component };
  const angularMock = { module: vi.fn(() => api) };
  globalThis.angular = angularMock;
  return { component, api, angularMock };
});

vi.mock('angular', () => ({
  default: hoisted.angularMock,
  module: hoisted.angularMock.module,
}));

vi.mock('@/react-tools/react2angular', () => ({
  r2a: (comp: unknown) => comp,
}));
vi.mock('@/react-tools/withControlledInput', () => ({
  withControlledInput: (c: unknown) => c,
}));
vi.mock(
  '@/react/portainer/custom-templates/components/CustomTemplatesVariablesField',
  () => ({
    CustomTemplatesVariablesField: () => null,
  })
);

import { VariablesFieldAngular } from './variables-field';

describe('custom-templates angular wrappers', () => {
  beforeEach(() => {
    hoisted.angularMock.module.mockClear();
    hoisted.component.mockClear();
  });

  it('registers react and angular variable field components', async () => {
    await import('./index');
    expect(hoisted.angularMock.module).toHaveBeenCalledWith(
      'portainer.app.react.components.custom-templates',
      []
    );
    const names = hoisted.component.mock.calls.map((c) => c[0]);
    expect(names).toEqual(
      expect.arrayContaining([
        'customTemplatesVariablesFieldReact',
        'customTemplatesVariablesField',
      ])
    );
  });

  it('forwards changes and validates required template variables', () => {
    const $scope = { $evalAsync: (fn: () => void) => fn() };
    const ctrl = new (VariablesFieldAngular.controller as new (
      ...args: unknown[]
    ) => {
      handleChange: (v: Record<string, string>) => void;
      $onChanges: (c: unknown) => void;
      checkValidity: (v: Record<string, string>) => void;
      formCtrl: { $setValidity: ReturnType<typeof vi.fn> };
      onChange: ReturnType<typeof vi.fn>;
      definitions: Array<{ name: string; defaultValue?: string }>;
      value: Record<string, string>;
    })($scope);

    ctrl.onChange = vi.fn();
    ctrl.formCtrl = { $setValidity: vi.fn() };
    ctrl.definitions = [
      { name: 'A', defaultValue: '' },
      { name: 'B', defaultValue: 'x' },
    ];
    ctrl.value = { A: '', B: '' };

    ctrl.handleChange({ A: '1', B: '' });
    expect(ctrl.onChange).toHaveBeenCalledWith({ A: '1', B: '' });

    ctrl.$onChanges({ value: { currentValue: { A: '', B: '' } } });
    expect(ctrl.formCtrl.$setValidity).toHaveBeenCalledWith(
      'templateVariables',
      false,
      ctrl.formCtrl
    );

    ctrl.checkValidity({ A: 'ok', B: '' });
    expect(ctrl.formCtrl.$setValidity).toHaveBeenCalledWith(
      'templateVariables',
      true,
      ctrl.formCtrl
    );

    ctrl.$onChanges({ value: {} });
  });
});
