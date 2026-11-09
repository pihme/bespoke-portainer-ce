import { describe, expect, it, vi, beforeEach } from 'vitest';
import ReactDOM from 'react-dom';

vi.mock('react-dom', () => ({
  default: {
    render: vi.fn(),
    unmountComponentAtNode: vi.fn(),
  },
}));

import { react2angular, r2a } from './react2angular';

function Demo({ value, onChange }: { value: string; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}>
      {value}
    </button>
  );
}
Demo.displayName = 'DemoWidget';

describe('react2angular', () => {
  beforeEach(() => {
    vi.mocked(ReactDOM.render).mockClear();
    vi.mocked(ReactDOM.unmountComponentAtNode).mockClear();
  });

  it('builds Angular bindings and a camelCased name from displayName', () => {
    const options = react2angular(Demo, ['value', 'onChange']);
    expect(options.name).toBe('demoWidget');
    expect(options.bindings).toEqual({ value: '<', onChange: '<' });
    expect(r2a).toBe(react2angular);
  });

  it('renders on $onChanges and unmounts once on $onDestroy', () => {
    const options = react2angular(Demo, ['value', 'onChange']);
    const el = document.createElement('div');
    const ctrl: Record<string, unknown> = {
      value: 'v1',
      onChange: vi.fn().mockReturnValue('handled'),
    };
    const $q = (fn: (resolve: (v: unknown) => void) => void) => {
      let resolved: unknown;
      fn((v) => {
        resolved = v;
      });
      return Promise.resolve(resolved);
    };

    // Angular instantiates the controller with `new`/injector; call with this.
    (
      options.controller as (
        this: Record<string, unknown>,
        $element: HTMLElement[],
        $q: typeof $q
      ) => void
    ).call(ctrl, [el], $q);

    (ctrl.$onChanges as () => void)();
    expect(ReactDOM.render).toHaveBeenCalledTimes(1);
    const props = (
      vi.mocked(ReactDOM.render).mock.calls[0][0] as React.ReactElement
    ).props.children.props;
    expect(props.value).toBe('v1');
    expect(typeof props.onChange).toBe('function');

    // function props are wrapped with $q
    expect(props.onChange('arg')).toBeInstanceOf(Promise);

    (ctrl.$onDestroy as () => void)();
    expect(ReactDOM.unmountComponentAtNode).toHaveBeenCalledWith(el);

    // second destroy / changes after destroy are no-ops
    (ctrl.$onDestroy as () => void)();
    (ctrl.$onChanges as () => void)();
    expect(ReactDOM.unmountComponentAtNode).toHaveBeenCalledTimes(1);
    expect(ReactDOM.render).toHaveBeenCalledTimes(1);
  });

  it('uses the component name when displayName is missing', () => {
    function NamedOnly({ n }: { n: number }) {
      return <span>{n}</span>;
    }
    const options = react2angular(NamedOnly, ['n']);
    expect(options.name).toBe('namedOnly');
  });
});
