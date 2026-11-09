import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Tabs } from './Tabs';

describe('Tabs', () => {
  it('renders contained tabs and handles clicks', async () => {
    const user = userEvent.setup();
    const onList = vi.fn();
    const onGrid = vi.fn();
    render(
      <Tabs.Container variant="contained" size="md" aria-label="View mode">
        <Tabs.Item isActive onClick={onList}>
          List
        </Tabs.Item>
        <Tabs.Item isActive={false} onClick={onGrid}>
          Grid
        </Tabs.Item>
        <Tabs.Item disabled onClick={onGrid}>
          Disabled
        </Tabs.Item>
      </Tabs.Container>
    );

    expect(screen.getByLabelText('View mode')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Grid' }));
    expect(onGrid).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    expect(onGrid).toHaveBeenCalledTimes(1);
  });

  it('renders pill and small variants', () => {
    render(
      <Tabs.Container variant="pill" size="sm" as="nav" aria-label="Pills">
        <Tabs.Item isActive size="sm">
          One
        </Tabs.Item>
        <Tabs.Item>Two</Tabs.Item>
      </Tabs.Container>
    );
    expect(screen.getByLabelText('Pills').tagName).toBe('NAV');
    expect(screen.getByRole('button', { name: 'One' })).toBeVisible();
  });

  it('supports asChild items', () => {
    render(
      <Tabs.Container>
        <Tabs.Item asChild isActive>
          <a href="#x">Link tab</a>
        </Tabs.Item>
      </Tabs.Container>
    );
    expect(screen.getByRole('link', { name: 'Link tab' })).toBeVisible();
  });
});
