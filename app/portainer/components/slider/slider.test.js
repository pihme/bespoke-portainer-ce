import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const controller = vi.fn();
  const component = vi.fn(() => moduleApi);
  const moduleApi = { controller, component };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { controller, component, moduleApi, angularMock };
});

vi.mock('angular', () => ({
  default: hoisted.angularMock,
  module: hoisted.angularMock.module,
}));

import SliderController from './sliderController.js';

describe('slider', () => {
  beforeEach(() => {
    hoisted.angularMock.module.mockClear();
    hoisted.controller.mockClear();
    hoisted.component.mockClear();
  });

  it('registers the slider component', async () => {
    await import('./slider.js');
    expect(hoisted.angularMock.module).toHaveBeenCalledWith('portainer.app');
    expect(hoisted.component).toHaveBeenCalledWith(
      'slider',
      expect.objectContaining({
        controller: 'SliderController',
        bindings: expect.objectContaining({
          model: '=',
          onChange: '<',
          floor: '<',
          ceil: '<',
        }),
      })
    );
  });

  it('builds slider options and translates unlimited floor', () => {
    const scope = {};
    const ctrl = new SliderController(scope);
    ctrl.floor = 0;
    ctrl.ceil = 10;
    ctrl.step = 1;
    ctrl.precision = 0;
    ctrl.onChange = vi.fn();
    ctrl.$onInit();

    expect(ctrl.options.floor).toBe(0);
    expect(ctrl.options.ceil).toBe(10);
    expect(ctrl.translate(0, 'id', 'floor')).toBe('unlimited');
    expect(ctrl.translate(0, 'id', 'other')).toBe('unlimited');
    expect(ctrl.translate(5, 'id', 'ceil')).toBe(5);

    ctrl.floor = 1;
    ctrl.$onChanges();
    expect(ctrl.translate(0, 'id', 'floor')).toBe('unlimited');
    expect(ctrl.translate(2, 'id', 'floor')).toBe(2);

    ctrl.options.onChange();
    expect(ctrl.onChange).toHaveBeenCalled();
  });
});
