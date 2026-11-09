import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AdditionalFileField } from './AdditionalFilesField';

describe('AdditionalFileField (backwards compatibility)', () => {
  it('renders existing paths and reports edits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AdditionalFileField
        value={['extra.yml']}
        onChange={onChange}
        errors={['bad path']}
      />
    );

    expect(screen.getByText('Additional paths')).toBeInTheDocument();
    expect(screen.getByDisplayValue('extra.yml')).toBeInTheDocument();
    expect(screen.getByText('bad path')).toBeInTheDocument();

    await user.clear(screen.getByDisplayValue('extra.yml'));
    await user.type(screen.getByRole('textbox'), 'other.yml');
    expect(onChange).toHaveBeenCalled();
  });

  it('adds a new empty path when Add file is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AdditionalFileField value={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /add file/i }));
    expect(onChange).toHaveBeenCalledWith([''], expect.anything());
  });
});
