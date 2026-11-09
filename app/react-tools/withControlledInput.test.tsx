import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';

import { withControlledInput } from './withControlledInput';

type SingleProps = {
  value: string;
  onChange: (v: string) => void;
  label?: string;
};

function SingleInput({ value, onChange, label }: SingleProps) {
  return (
    <label>
      {label}
      <input
        aria-label="single"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

type MultiProps = {
  valueStr: string;
  onChangeStr: (v: string) => void;
  valueNum: number;
  onChangeNum: (v: number) => void;
};

function MultiInput({
  valueStr,
  onChangeStr,
  valueNum,
  onChangeNum,
}: MultiProps) {
  return (
    <>
      <input
        aria-label="str"
        value={valueStr}
        onChange={(e) => onChangeStr(e.target.value)}
      />
      <input
        aria-label="num"
        type="number"
        value={valueNum}
        onChange={(e) => onChangeNum(Number(e.target.value))}
      />
    </>
  );
}

describe('withControlledInput', () => {
  it('syncs a default value/onChange pair through React state', () => {
    const onChange = vi.fn();
    const Wrapped = withControlledInput(SingleInput);

    function Host() {
      const [value, setValue] = useState('initial');
      return (
        <Wrapped
          value={value}
          onChange={(v) => {
            onChange(v);
            setValue(v);
          }}
          label="Name"
        />
      );
    }

    render(<Host />);
    const input = screen.getByLabelText('single');
    expect(input).toHaveValue('initial');

    fireEvent.change(input, { target: { value: 'typed' } });
    expect(onChange).toHaveBeenCalledWith('typed');
    expect(input).toHaveValue('typed');
  });

  it('supports multiple controlled pairs and displayName fallback', () => {
    const onChangeStr = vi.fn();
    const onChangeNum = vi.fn();
    const Wrapped = withControlledInput(MultiInput, {
      valueStr: 'onChangeStr',
      valueNum: 'onChangeNum',
    });
    expect(Wrapped.displayName).toBe('withControlledInput(MultiInput)');

    render(
      <Wrapped
        valueStr="a"
        onChangeStr={onChangeStr}
        valueNum={1}
        onChangeNum={onChangeNum}
      />
    );

    fireEvent.change(screen.getByLabelText('str'), {
      target: { value: 'b' },
    });
    fireEvent.change(screen.getByLabelText('num'), {
      target: { value: '9' },
    });

    expect(onChangeStr).toHaveBeenCalledWith('b');
    expect(onChangeNum).toHaveBeenCalledWith(9);
  });

  it('updates controlled state when props change from outside React', () => {
    const Wrapped = withControlledInput(SingleInput);
    const { rerender } = render(
      <Wrapped value="one" onChange={() => undefined} />
    );
    expect(screen.getByLabelText('single')).toHaveValue('one');

    rerender(<Wrapped value="two" onChange={() => undefined} />);
    expect(screen.getByLabelText('single')).toHaveValue('two');
  });

  it('tolerates a missing onChange handler', () => {
    const Wrapped = withControlledInput(SingleInput);
    render(
      <Wrapped
        value="x"
        // force a non-function onChange through the outer props bag
        {...({ onChange: undefined } as unknown as Pick<
          SingleProps,
          'onChange'
        >)}
      />
    );

    act(() => {
      fireEvent.change(screen.getByLabelText('single'), {
        target: { value: 'y' },
      });
    });
    expect(screen.getByLabelText('single')).toHaveValue('y');
  });

  it('falls back to Component for anonymous wrappers', () => {
    const Anonymous = (() => null) as React.ComponentType;
    Object.defineProperty(Anonymous, 'name', { value: '' });
    expect(withControlledInput(Anonymous).displayName).toBe(
      'withControlledInput(Component)'
    );
  });
});
