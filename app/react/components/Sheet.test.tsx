import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTrigger,
} from './Sheet';

describe('Sheet', () => {
  it('opens content with a title, description, and close button', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button">Open</button>
        </SheetTrigger>
        <SheetContent title="Drawer" side="right">
          <SheetDescription>Details</SheetDescription>
          Body
        </SheetContent>
      </Sheet>
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Drawer')).toBeVisible();
    expect(screen.getByText('Details')).toBeVisible();
    expect(screen.getByText('Body')).toBeVisible();
    expect(screen.getByRole('button', { name: /close/i })).toBeVisible();
  });

  it('renders SheetHeader with a reload action', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(
      <Sheet open>
        <SheetContent showCloseButton={false} side="left" aria-describedby={undefined}>
          <SheetHeader title="Reloadable" onReload={onReload}>
            <span>extra</span>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByText('Reloadable')).toBeVisible();
    expect(screen.getByText('extra')).toBeVisible();
    await user.click(screen.getByTitle('Refresh drawer content'));
    expect(onReload).toHaveBeenCalled();
  });
});
