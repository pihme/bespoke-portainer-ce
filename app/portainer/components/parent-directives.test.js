import { describe, expect, it, vi } from 'vitest';

const { moduleApi, angularMock, directiveDefs } = vi.hoisted(() => {
  const directiveDefs = {};
  const moduleApi = {
    directive: vi.fn((name, factory) => {
      const impl = Array.isArray(factory) ? factory[factory.length - 1] : factory;
      directiveDefs[name] = impl;
      return moduleApi;
    }),
    component: vi.fn(() => moduleApi),
    name: 'portainer.app.components',
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return { moduleApi, angularMock, directiveDefs };
});

vi.mock('angular', () => ({ default: angularMock, module: angularMock.module }));
vi.mock('./form-components', () => ({ default: 'form' }));
vi.mock('./widget', () => ({ default: 'widget' }));
vi.mock('./BoxSelector', () => ({ boxSelectorModule: 'box' }));
vi.mock('./BEFeatureIndicator', () => ({ beFeatureIndicator: {} }));
vi.mock('./InformationPanel', () => ({ InformationPanelAngular: {} }));
vi.mock('./forms/git-form', () => ({ gitFormModule: 'git' }));
vi.mock('./tls-fieldset', () => ({ tlsFieldsetModule: 'tls' }));

await import('./autofocus.js');
await import('./focusIf.js');
await import('./buttonSpinner.js');
await import('./onEnterKey.js');
await import('./template-widget.js');
await import('./index.js');

describe('portainer components parent directives (backwards compatibility)', () => {
  it('registers the components module wiring', () => {
    expect(angularMock.module).toHaveBeenCalled();
    // REQ-TAI-001: no access-management component module
    const call = angularMock.module.mock.calls.find(
      ([name]) => name === 'portainer.app.components'
    );
    expect(call?.[1] ?? []).not.toContain('access');
    expect(moduleApi.component).toHaveBeenCalledWith(
      'informationPanel',
      expect.anything()
    );
  });

  it('defines parent-level directives', () => {
    expect(Object.keys(directiveDefs)).toEqual(
      expect.arrayContaining([
        'autoFocus',
        'focusIf',
        'buttonSpinner',
        'onEnterKey',
        'rdTemplateWidget',
      ])
    );
  });

  it('buttonSpinner exposes spinning binding and spinner template', () => {
    const def = directiveDefs.buttonSpinner();
    expect(def.scope.spinning).toBe('=buttonSpinner');
    expect(def.template).toContain('animate-spin-slow');
  });

  it('onEnterKey evaluates expression on enter', () => {
    const def = directiveDefs.onEnterKey();
    const evalFn = vi.fn();
    const apply = vi.fn((fn) => fn());
    const bind = vi.fn();
    def.link({ $apply: apply, $eval: evalFn }, { bind }, { onEnterKey: 'doIt()' });
    const handler = bind.mock.calls[0][1];
    handler({ which: 13, preventDefault: vi.fn() });
    expect(apply).toHaveBeenCalled();
    expect(evalFn).toHaveBeenCalledWith('doIt()');
  });

  it('template widget renders a widget wrapper', () => {
    const def = directiveDefs.rdTemplateWidget();
    expect(def.template).toContain('template-widget');
  });

  it('autoFocus focuses the element after timeout', () => {
    const timeout = vi.fn((fn) => fn());
    const def = directiveDefs.autoFocus(timeout);
    const focus = vi.fn();
    def.link({}, [{ focus }]);
    expect(timeout).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('focusIf watches the attribute and focuses when true', () => {
    const timeout = vi.fn((fn) => fn());
    const def = directiveDefs.focusIf(timeout);
    const watch = vi.fn();
    const evalFn = vi.fn(() => 0);
    const focus = vi.fn();
    def.link(
      { $watch: watch, $eval: evalFn },
      [{ focus }],
      { focusIf: 'shouldFocus', focusDelay: '0' }
    );
    expect(watch).toHaveBeenCalledWith('shouldFocus', expect.any(Function));
    const focusCb = watch.mock.calls[0][1];
    focusCb(true);
    expect(timeout).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('focusIf focuses immediately without attribute', () => {
    const timeout = vi.fn((fn) => fn());
    const def = directiveDefs.focusIf(timeout);
    const focus = vi.fn();
    def.link({ $watch: vi.fn(), $eval: vi.fn(() => 0) }, [{ focus }], {});
    expect(timeout).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });
});
