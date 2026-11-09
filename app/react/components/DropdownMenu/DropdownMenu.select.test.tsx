import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@reach/menu-button', () => {
  function Menu({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }
  function MenuButton({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
      <button type="button" onClick={onClick} {...rest}>
        {children}
      </button>
    );
  }
  function MenuList({ children }: { children: React.ReactNode }) {
    return <div role="menu">{children}</div>;
  }
  function MenuItem({
    children,
    onSelect,
    className,
  }: {
    children: React.ReactNode;
    onSelect: () => void;
    className?: string;
  }) {
    return (
      <button type="button" role="menuitem" className={className} onClick={onSelect}>
        {children}
      </button>
    );
  }
  return { Menu, MenuButton, MenuList, MenuItem };
});

import { DropdownMenu } from './DropdownMenu';

describe('DropdownMenu onSelect wiring', () => {
  it('forwards option key and All null selections', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        label="Group"
        options={[{ key: 'Docker', count: 1 }]}
        selected={null}
        onSelect={onSelect}
      />
    );
    await user.click(screen.getByRole('menuitem', { name: /Docker/ }));
    expect(onSelect).toHaveBeenCalledWith('Docker');
    await user.click(screen.getByRole('menuitem', { name: /All/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
