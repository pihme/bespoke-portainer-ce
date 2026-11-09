import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/react/constants', () => ({
  BROWSER_OS_PLATFORM: 'mac',
}));

import { TerminalTooltip } from './TerminalTooltip';

describe('TerminalTooltip', () => {
  it('renders the mac console shortcut tooltip', () => {
    const { container } = render(<TerminalTooltip />);
    // Tooltip wraps an info icon; ensure the component mounts
    expect(container.querySelector('svg') || container.firstChild).toBeTruthy();
  });
});
