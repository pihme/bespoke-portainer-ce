import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react-hooks';
import { vi } from 'vitest';

import { HomepageFilter, useHomePageFilter } from './HomepageFilter';

describe('HomepageFilter (backwards compatibility)', () => {
  it('renders multi-select options and reports changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <HomepageFilter
        placeHolder="Filter by type"
        value={[]}
        onChange={onChange}
        filterOptions={[
          { value: 1, label: 'Docker' },
          { value: 2, label: 'Podman' },
        ]}
      />
    );

    expect(screen.getByText('Filter by type')).toBeVisible();
    await user.click(screen.getByText('Filter by type'));
    await user.click(await screen.findByText('Docker'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([1]);
  });

  it('useHomePageFilter persists values in sessionStorage', () => {
    sessionStorage.clear();
    const { result } = renderHook(() =>
      useHomePageFilter<number[]>('types', [])
    );

    expect(result.current[0]).toEqual([]);
    act(() => {
      result.current[1]([3, 4]);
    });
    expect(result.current[0]).toEqual([3, 4]);
  });
});
