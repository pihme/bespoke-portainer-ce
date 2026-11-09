import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InformationPanel } from './InformationPanel';

describe('InformationPanel', () => {
  it('renders title, children, and calls onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <InformationPanel
        title="Tips"
        onDismiss={onDismiss}
        bodyClassName="body"
        wrapperStyle={{ padding: '4px' }}
      >
        Read the docs
      </InformationPanel>
    );
    expect(screen.getByText('Tips')).toBeVisible();
    expect(screen.getByText('Read the docs')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('omits the dismiss control when onDismiss is absent', () => {
    render(<InformationPanel>Body only</InformationPanel>);
    expect(screen.getByText('Body only')).toBeVisible();
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });
});
