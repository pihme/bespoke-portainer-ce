import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InputSearch } from './InputSearch';

vi.mock('@@/form-components/AutocompleteSelect', () => ({
  AutocompleteSelect: ({
    value,
    onChange,
    searchResults,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    searchResults: Array<{ value: string }>;
    placeholder?: string;
  }) => (
    <div>
      <input
        aria-label="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <ul>
        {searchResults.map((r) => (
          <li key={r.value}>{r.value}</li>
        ))}
      </ul>
    </div>
  ),
}));

describe('InputSearch', () => {
  it('filters options by the current value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <InputSearch
        value=""
        onChange={onChange}
        options={[
          { label: 'nginx', value: 'nginx' },
          { label: 'redis', value: 'redis' },
        ]}
        inputId="img"
        data-cy="img-search"
      />
    );
    expect(screen.queryByText('nginx')).toBeNull();

    rerender(
      <InputSearch
        value="ng"
        onChange={onChange}
        options={[
          { label: 'nginx', value: 'nginx' },
          { label: 'redis', value: 'redis' },
        ]}
        inputId="img"
        data-cy="img-search"
      />
    );
    expect(screen.getByText('nginx')).toBeVisible();
    expect(screen.queryByText('redis')).toBeNull();

    await user.type(screen.getByLabelText('search'), 'x');
    expect(onChange).toHaveBeenCalled();
  });
});
