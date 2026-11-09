import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import selectEvent from '@/react/test-utils/react-select';

import { PortainerSelect } from './PortainerSelect';
import { CustomComponents } from './PortainerSelectCustomRenderers';

describe('PortainerSelect', () => {
  const options = [
    { value: 'bridge', label: 'Bridge' },
    { value: 'host', label: 'Host', disabled: true },
    { value: 'none', label: 'None' },
  ];

  it('selects a single value and clears it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PortainerSelect
        value="bridge"
        onChange={onChange}
        options={options}
        data-cy="net"
        inputId="net"
        isClearable
      />
    );

    const input = screen.getByRole('combobox');
    await selectEvent.select(input, 'None', { user });
    expect(onChange).toHaveBeenCalledWith('none');
  });

  it('supports grouped options and numeric zero value', () => {
    const onChange = vi.fn();
    render(
      <PortainerSelect
        value={0}
        onChange={onChange}
        options={[
          {
            label: 'Group',
            options: [
              { value: 0, label: 'Zero' },
              { value: 1, label: 'One' },
            ],
          },
        ]}
        data-cy="num"
        inputId="num"
      />
    );
    expect(screen.getByText('Zero')).toBeVisible();
  });

  it('multi-select reports selected values and blur-creates', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PortainerSelect
        isMulti
        value={['a']}
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        data-cy="multi"
        inputId="multi"
      />
    );

    const input = screen.getByRole('combobox');
    await selectEvent.select(input, 'B', { user });
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('creatable multi clears input via onCreateOption path', async () => {
    const user = userEvent.setup();
    const onCreateOption = vi.fn();
    render(
      <PortainerSelect
        isMulti
        isCreatable
        value={[]}
        onChange={() => {}}
        onCreateOption={onCreateOption}
        options={[]}
        data-cy="create"
        inputId="create"
        formatCreateLabel={(v) => `Add ${v}`}
      />
    );
    const input = screen.getByRole('combobox');
    await user.type(input, 'newtag');
    // blur should create
    await user.tab();
    expect(onCreateOption).toHaveBeenCalledWith('newtag');
  });

  it('uses custom components renderer', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const components = CustomComponents<string>((data) => (
      <span data-cy={`opt-${data.value}`}>{data.label.toUpperCase()}</span>
    ));
    render(
      <PortainerSelect
        value="bridge"
        onChange={onChange}
        options={options}
        components={components}
        data-cy="custom"
        inputId="custom"
      />
    );
    expect(screen.getByTestId('opt-bridge')).toHaveTextContent('BRIDGE');
    const input = screen.getByRole('combobox');
    await selectEvent.openMenu(input);
    expect(screen.getByTestId('opt-none')).toHaveTextContent('NONE');
  });
});
