import { beforeEach, describe, expect, it, vi } from 'vitest';

const { angularMock, moduleApi, components } = vi.hoisted(() => {
  const components: Array<{ name: string; def: unknown }> = [];
  const moduleApi = {
    component: vi.fn((name: string, def: unknown) => {
      components.push({ name, def });
      return moduleApi;
    }),
    name: 'portainer.app.components.widget',
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  return { angularMock, moduleApi, components };
});

vi.mock('angular', () => ({
  default: angularMock,
}));

import { rdWidget } from './rd-widget';
import { rdWidgetBody } from './rd-widget-body';
import { rdWidgetCustomHeader } from './rd-widget-custom-header';
import { rdWidgetFooter } from './rd-widget-footer';
import { rdWidgetTaskbar } from './rd-widget-taskbar';
import { rdWidgetTitle } from './rd-widget-title';

describe('Angular rd-widget leftovers', () => {
  beforeEach(() => {
    components.length = 0;
    angularMock.module.mockClear();
    moduleApi.component.mockClear();
  });

  it('defines widget shell templates and bindings', () => {
    expect(rdWidget.transclude).toBe(true);
    expect(rdWidget.template).toContain('class="widget"');
    expect(rdWidgetBody.bindings).toMatchObject({
      loading: '@?',
      classes: '@?',
    });
    expect(rdWidgetBody.template).toContain('widget-body');
    expect(rdWidgetTitle.bindings).toMatchObject({
      titleText: '@',
      icon: '@',
    });
    expect(rdWidgetFooter.template).toContain('widget-footer');
    expect(rdWidgetTaskbar.template).toContain('widget-header');
    expect(rdWidgetCustomHeader.template).toContain('widget-header');
  });

  it('registers all rd-widget components on the Angular module', async () => {
    await import('./index');
    expect(angularMock.module).toHaveBeenCalledWith(
      'portainer.app.components.widget',
      []
    );
    const names = components.map((c) => c.name);
    expect(names).toEqual([
      'rdWidget',
      'rdWidgetBody',
      'rdWidgetCustomHeader',
      'rdWidgetFooter',
      'rdWidgetHeader',
      'rdWidgetTaskbar',
    ]);
  });
});
