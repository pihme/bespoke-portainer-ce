import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { PageInput } from './PageInput';

describe('PageInput', () => {
  it('submits a valid page number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PageInput totalPages={10} onChange={onChange} />);
    await user.type(screen.getByTestId('pagination-go-to-page-input'), '4');
    await user.click(screen.getByTestId('pagination-go-to-page-button'));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
