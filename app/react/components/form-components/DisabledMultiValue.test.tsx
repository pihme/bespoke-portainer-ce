import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-select', async () => {
  const actual = await vi.importActual<typeof import('react-select')>(
    'react-select'
  );
  return {
    ...actual,
    components: {
      ...actual.components,
      MultiValue: ({
        children,
        isDisabled,
      }: {
        children?: React.ReactNode;
        isDisabled?: boolean;
      }) => (
        <div data-cy="multi-value" data-disabled={String(!!isDisabled)}>
          {children}
        </div>
      ),
      MultiValueRemove: ({ children }: { children?: React.ReactNode }) => (
        <button type="button" data-cy="multi-value-remove">
          {children ?? 'x'}
        </button>
      ),
    },
  };
});

vi.mock('@@/Tip/TooltipWithChildren', () => ({
  TooltipWithChildren: ({
    message,
    children,
  }: {
    message: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-cy="disabled-tooltip">
      <span data-cy="disabled-tooltip-msg">{message}</span>
      {children}
    </div>
  ),
}));

import {
  DisabledMultiValue,
  DisabledMultiValueRemove,
  preserveProtectedValues,
  type DisabledOption,
} from './DisabledMultiValue';
import type { Option } from './PortainerSelect';

describe('preserveProtectedValues', () => {
  it('unions selected and protected values', () => {
    expect(preserveProtectedValues(['a'], ['b', 'a'])).toEqual(['a', 'b']);
  });
});

describe('DisabledMultiValue', () => {
  it('wraps disabled values with a tooltip when message is set', () => {
    const data: DisabledOption<string> = {
      value: 'sys',
      label: 'sys',
      disabled: true,
      disabledMessage: 'Protected',
    };
    render(
      <DisabledMultiValue
        data={data}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...({ children: 'sys' } as never)}
      />
    );
    expect(screen.getByTestId('disabled-tooltip-msg')).toHaveTextContent(
      'Protected'
    );
    expect(screen.getByTestId('multi-value')).toHaveAttribute(
      'data-disabled',
      'true'
    );
  });

  it('renders without tooltip when not disabled', () => {
    const data: DisabledOption<string> = { value: 'ok', label: 'ok' };
    render(
      <DisabledMultiValue
        data={data}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...({ children: 'ok' } as never)}
      />
    );
    expect(screen.queryByTestId('disabled-tooltip')).not.toBeInTheDocument();
    expect(screen.getByText('ok')).toBeVisible();
  });
});

describe('DisabledMultiValueRemove', () => {
  it('hides remove for disabled values and shows it otherwise', () => {
    const disabled: Option<string> = {
      value: 'sys',
      label: 'sys',
      disabled: true,
    };
    const enabled: Option<string> = { value: 'ok', label: 'ok' };

    const { rerender, container } = render(
      <DisabledMultiValueRemove
        data={disabled}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...({} as never)}
      />
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <DisabledMultiValueRemove
        data={enabled}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...({} as never)}
      />
    );
    expect(screen.getByTestId('multi-value-remove')).toBeVisible();
  });
});
