import { beforeEach, describe, expect, it, vi } from 'vitest';

import CustomTemplateSelectorController from './custom-template-selector.controller.js';

describe('CustomTemplateSelectorController', () => {
  let $async;
  let CustomTemplateService;
  let Notifications;
  let controller;

  beforeEach(() => {
    $async = vi.fn(async (fn) => fn());
    CustomTemplateService = {
      customTemplates: vi.fn(),
    };
    Notifications = { error: vi.fn() };
    controller = new CustomTemplateSelectorController(
      $async,
      CustomTemplateService,
      Notifications
    );
    controller.stackType = 2;
    controller.onChange = vi.fn();
  });

  it('loads templates on init and selects the current value', async () => {
    CustomTemplateService.customTemplates.mockResolvedValue([
      { Id: 5, Title: 'Nginx', Description: 'web' },
    ]);
    controller.value = 5;

    await controller.$onInit();

    expect(CustomTemplateService.customTemplates).toHaveBeenCalledWith(2);
    expect(controller.templates[0].label).toBe('Nginx - web');
    expect(controller.selectedTemplate.Id).toBe(5);
    expect(controller.onChange).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ Id: 5 })
    );
  });

  it('notifies on load failure', async () => {
    const err = new Error('boom');
    CustomTemplateService.customTemplates.mockRejectedValue(err);

    await controller.$onInit();

    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to retrieve Custom Templates'
    );
  });

  it('reacts to value changes once templates are loaded', async () => {
    controller.templates = [
      { Id: 1, Title: 'A', Description: 'a', label: 'A - a' },
      { Id: 2, Title: 'B', Description: 'b', label: 'B - b' },
    ];
    controller.$onChanges({ value: { currentValue: 2 } });
    expect(controller.selectedTemplate.Id).toBe(2);
    expect(controller.onChange).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ Id: 2 })
    );
  });
});
