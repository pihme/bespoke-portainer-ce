import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AutocompleteSelect } from './AutocompleteSelect';

describe('AutocompleteSelect', () => {
  it('renders the input and calls onChange when typing (debounced)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AutocompleteSelect
        value=""
        onChange={onChange}
        inputId="compose-path"
        data-cy="autocomplete"
        placeholder="path"
        searchResults={[
          { value: 'docker-compose.yml', label: 'docker-compose.yml' },
        ]}
      />
    );
    const input = screen.getByPlaceholderText('path');
    await user.type(input, 'doc');
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('shows results and selects one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AutocompleteSelect
        value=""
        onChange={onChange}
        inputId="compose-path"
        data-cy="autocomplete"
        placeholder="path"
        searchResults={[
          { value: 'docker-compose.yml', label: 'docker-compose.yml' },
        ]}
      />
    );
    const input = screen.getByPlaceholderText('path');
    await user.click(input);
    await user.type(input, 'd');
    const option = await screen.findByRole('option');
    expect(option).toHaveTextContent('docker-compose.yml');
    await user.click(option);
    expect(onChange).toHaveBeenCalledWith('docker-compose.yml');
  });

  it('respects disabled', () => {
    render(
      <AutocompleteSelect
        value=""
        onChange={() => {}}
        inputId="compose-path"
        data-cy="autocomplete"
        disabled
      />
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
