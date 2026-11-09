import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react-hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchBar, useSearchBarState } from './SearchBar';

describe('SearchBar (backwards compatibility)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('updates the debounced value and clears it from the clear button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchBar
        value=""
        onChange={onChange}
        data-cy="search-volumes"
        placeholder="Find volumes"
      >
        <span>extra</span>
      </SearchBar>
    );

    expect(screen.getByPlaceholderText('Find volumes')).toBeInTheDocument();
    expect(screen.getByText('extra')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search input'), 'nginx');
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('nginx');
    });

    await user.click(screen.getByTestId('search-volumes-clear-button'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  it('useSearchBarState persists the filter under a datatable key', () => {
    const key = `search-${Date.now()}`;
    const { result } = renderHook(() => useSearchBarState(key));

    expect(result.current[0]).toBe('');
    act(() => {
      result.current[1]('container');
    });
    expect(result.current[0]).toBe('container');

    const storedKey = Object.keys(sessionStorage).find((k) =>
      k.includes(`datatable_text_filter_${key}`)
    );
    expect(storedKey).toBeTruthy();
  });
});
