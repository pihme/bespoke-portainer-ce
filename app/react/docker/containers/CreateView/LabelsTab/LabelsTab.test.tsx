import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { LabelsTab } from './LabelsTab';

describe('REQ-CTR-03 LabelsTab', () => {
  it('adds an empty label row', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LabelsTab values={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /add item/i }));
    expect(onChange).toHaveBeenCalledWith([{ name: '', value: '' }]);
  });
});
