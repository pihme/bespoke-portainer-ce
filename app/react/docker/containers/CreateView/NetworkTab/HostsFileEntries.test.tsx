import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { HostsFileEntries } from './HostsFileEntries';

describe('REQ-CTR-03 HostsFileEntries', () => {
  it('adds a hosts file entry row', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HostsFileEntries values={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(onChange).toHaveBeenCalledWith(['']);
  });
});
