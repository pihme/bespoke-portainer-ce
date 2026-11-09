import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';

import { InputList } from './InputList';
import { useInputList } from './useInputList';
import { arrayMove, defaultItemBuilder, hasKey } from './utils';

describe('InputList utils leftovers', () => {
  it('arrayMove throws on invalid indexes and returns copy when same index', () => {
    expect(() => arrayMove([1, 2], -1, 0)).toThrow(/out of bounds/);
    expect(arrayMove([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
  });

  it('hasKey and defaultItemBuilder', () => {
    expect(hasKey({ needsDeletion: true }, 'needsDeletion')).toBe(true);
    expect(hasKey(null, 'needsDeletion')).toBe(false);
    expect(defaultItemBuilder()).toEqual({ value: '' });
  });
});

describe('useInputList', () => {
  it('adds, updates, removes and moves items when movable', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) =>
        useInputList({
          value,
          onChange,
          movable: true,
          itemBuilder: () => ({ value: 'new' }),
        }),
      { initialProps: { value: [{ value: 'a' }, { value: 'b' }] } }
    );

    act(() => result.current.handleAdd());
    expect(onChange).toHaveBeenLastCalledWith(
      [{ value: 'a' }, { value: 'b' }, { value: 'new' }],
      { type: 'create', item: { value: 'new' } }
    );

    act(() => result.current.handleChangeItem(0, { value: 'A' }));
    expect(onChange).toHaveBeenLastCalledWith(
      [{ value: 'A' }, { value: 'b' }],
      { type: 'update', item: { value: 'A' } }
    );

    act(() => result.current.handleRemoveItem(1, { value: 'b' }));
    expect(onChange).toHaveBeenLastCalledWith([{ value: 'a' }], {
      type: 'delete',
      item: { value: 'b' },
    });

    act(() => result.current.handleMoveDown(0));
    expect(onChange).toHaveBeenLastCalledWith(
      [{ value: 'b' }, { value: 'a' }],
      { type: 'move', fromIndex: 0, to: 1 }
    );

    act(() => result.current.handleMoveUp(0));
    // index 0 move up is a no-op
    expect(onChange).toHaveBeenCalledTimes(4);

    act(() => result.current.toggleNeedsDeletion(0, {
      value: 'a',
      needsDeletion: false,
    }));
    expect(onChange).toHaveBeenLastCalledWith(
      [{ value: 'a', needsDeletion: true }, { value: 'b' }],
      { type: 'update', item: { value: 'a', needsDeletion: true } }
    );

    // not movable
    onChange.mockClear();
    rerender({ value: [{ value: 'a' }, { value: 'b' }] });
    const { result: r2 } = renderHook(() =>
      useInputList({
        value: [{ value: 'a' }, { value: 'b' }],
        onChange,
        movable: false,
      })
    );
    act(() => r2.current.handleMoveDown(0));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('InputList', () => {
  it('renders items, add/remove, tooltip and tip', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <InputList
        label="Labels"
        tooltip="tip"
        textTip="helper"
        value={[{ value: 'one' }]}
        onChange={onChange}
        data-cy="labels"
        addLabel="Add label"
        errors={['bad']}
      />
    );
    expect(screen.getByText('Labels')).toBeVisible();
    expect(screen.getByText('helper')).toBeVisible();
    expect(screen.getByDisplayValue('one')).toBeVisible();
    expect(screen.getByText('bad')).toBeVisible();

    await user.click(screen.getByTestId('labelsAddButton'));
    expect(onChange).toHaveBeenCalledWith(
      [{ value: 'one' }, { value: '' }],
      expect.objectContaining({ type: 'create' })
    );

    await user.click(screen.getByRole('button', { name: 'Remove item' }));
    expect(onChange).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ type: 'delete' })
    );
  });

  it('supports movable controls and custom item component', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Item({
      item,
      onChange: change,
    }: {
      item: { value: string };
      onChange: (v: { value: string }) => void;
      index: number;
    }) {
      return (
        <input
          aria-label="custom"
          value={item.value}
          onChange={(e) => change({ value: e.target.value })}
        />
      );
    }

    render(
      <InputList
        value={[{ value: 'a' }, { value: 'b' }]}
        onChange={onChange}
        movable
        item={Item}
        data-cy="list"
        addButtonError="limit reached"
      />
    );
    expect(screen.getByText('limit reached')).toBeVisible();
    await user.click(screen.getByTestId('list-move-down_0'));
    expect(onChange).toHaveBeenCalledWith(
      [{ value: 'b' }, { value: 'a' }],
      expect.objectContaining({ type: 'move' })
    );
  });

  it('canUndoDelete toggles needsDeletion for existing items', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <InputList
        value={[{ value: 'keep', needsDeletion: false }]}
        onChange={onChange}
        canUndoDelete
        data-cy="undo"
      />
    );
    await user.click(screen.getByTestId('undoRemoveButton_0_delete'));
    expect(onChange).toHaveBeenCalledWith(
      [{ value: 'keep', needsDeletion: true }],
      expect.objectContaining({ type: 'update' })
    );
  });

  it('removes newly added undoable items immediately', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <InputList
        value={[{ value: 'keep', needsDeletion: false }]}
        onChange={onChange}
        canUndoDelete
        data-cy="undo2"
      />
    );
    const next = [
      { value: 'keep', needsDeletion: false },
      { value: 'new', needsDeletion: false },
    ];
    rerender(
      <InputList
        value={next}
        onChange={onChange}
        canUndoDelete
        data-cy="undo2"
      />
    );
    await user.click(screen.getByTestId('undo2RemoveButton_1_delete'));
    expect(onChange).toHaveBeenCalledWith(
      [{ value: 'keep', needsDeletion: false }],
      expect.objectContaining({ type: 'delete' })
    );
  });
});
