import { describe, expect, it, vi } from 'vitest';

import { BoxSelectorAngular } from './BoxSelectorAngular';

describe('BoxSelectorAngular controller', () => {
  it('REQ-TAI-018 forwards onChange via $evalAsync without Business Edition validity', () => {
    const Controller = BoxSelectorAngular.controller as new ($scope: {
      $evalAsync: (fn: () => void) => void;
    }) => {
      formCtrl: { $setValidity: ReturnType<typeof vi.fn> };
      onChange: ReturnType<typeof vi.fn>;
      radioName: string;
      handleChange: (value: string | number) => void;
    };
    const $scope = { $evalAsync: (fn: () => void) => fn() };
    const ctrl = new Controller($scope);
    ctrl.formCtrl = { $setValidity: vi.fn() };
    ctrl.onChange = vi.fn();
    ctrl.radioName = 'method';

    ctrl.handleChange('compose');
    expect(ctrl.onChange).toHaveBeenCalledWith('compose');
    expect(ctrl.formCtrl.$setValidity).not.toHaveBeenCalled();
  });

  it('exposes react bridge template and form require', () => {
    expect(BoxSelectorAngular.template).toContain('box-selector-react');
    expect(BoxSelectorAngular.require).toEqual({ formCtrl: '^form' });
    expect(BoxSelectorAngular.bindings).toMatchObject({
      value: '<',
      onChange: '<',
      options: '<',
      radioName: '<',
    });
  });
});
