import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { GpusList, gpusListValidation, Gpu } from './GpusList';

vi.mock('@@/form-components/InputList', () => ({
  InputList: ({
    label,
    value,
    onChange,
    itemBuilder,
    item: Item,
    addLabel,
  }: {
    label: string;
    value: Gpu[];
    onChange: (v: Gpu[]) => void;
    itemBuilder: () => Gpu;
    item: React.ComponentType<{
      item: Gpu;
      onChange: (v: Gpu) => void;
      index: number;
    }>;
    addLabel: string;
  }) => (
    <div>
      <span>{label}</span>
      {value.map((item, index) => (
        <Item
          key={index}
          item={item}
          index={index}
          onChange={(next) => {
            const copy = [...value];
            copy[index] = next;
            onChange(copy);
          }}
        />
      ))}
      <button type="button" onClick={() => onChange([...value, itemBuilder()])}>
        {addLabel}
      </button>
    </div>
  ),
}));

vi.mock('@@/form-components/InputGroup', () => {
  const Input = ({
    value,
    onChange,
    'data-cy': dataCy,
    placeholder,
  }: {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    'data-cy'?: string;
    placeholder?: string;
  }) => (
    <input
      data-cy={dataCy}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
    />
  );
  const Addon = ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  );
  const Group = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  Group.Input = Input;
  Group.Addon = Addon;
  return { InputGroup: Group };
});

describe('GpusList', () => {
  it('renders GPU rows and forwards edits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GpusList
        value={[{ name: 'gpu0', value: '0' }]}
        onChange={onChange}
      />
    );
    expect(screen.getByText('GPUs')).toBeVisible();
    await user.clear(screen.getByTestId('docker-gpu-name_0'));
    await user.type(screen.getByTestId('docker-gpu-name_0'), 'n');
    expect(onChange).toHaveBeenCalled();
    await user.clear(screen.getByTestId('docker-gpu-value_0'));
    await user.type(screen.getByTestId('docker-gpu-value_0'), '1');
    expect(onChange).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Add GPU' }));
    expect(onChange).toHaveBeenCalledWith([
      { name: 'gpu0', value: '0' },
      { name: '', value: '' },
    ]);
  });
});

describe('gpusListValidation', () => {
  it('defaults to an empty list and requires name/value', async () => {
    await expect(gpusListValidation().validate(undefined)).resolves.toEqual([]);
    await expect(
      gpusListValidation().validate([{ name: '', value: '' }])
    ).rejects.toThrow();
    await expect(
      gpusListValidation().validate([{ name: 'a', value: '0' }])
    ).resolves.toEqual([{ name: 'a', value: '0' }]);
  });
});
