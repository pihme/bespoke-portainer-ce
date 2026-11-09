import { render, screen } from '@testing-library/react';
import { Box } from 'lucide-react';
import { vi } from 'vitest';

import { withTestRouter } from '@/react/test-utils/withRouter';

import { Context } from '../useSidebarState';

import { SidebarItem } from './SidebarItem';

vi.mock('./useSidebarSrefActive', () => ({
  useSidebarSrefActive: () => ({
    href: '#/docker/containers',
    onClick: vi.fn(),
    className: '',
  }),
}));

function renderItem(
  props: Partial<React.ComponentProps<typeof SidebarItem>> = {},
  isOpen = true
) {
  const Wrapped = withTestRouter(SidebarItem);
  return render(
    <Context.Provider value={{ isOpen, toggle: vi.fn() }}>
      <ul>
        <Wrapped
          to="docker.containers"
          label="Containers"
          icon={Box}
          data-cy="dockerSidebar-containers"
          {...props}
        />
      </ul>
    </Context.Provider>
  );
}

describe('SidebarItem', () => {
  it('renders label and icon when sidebar is open', () => {
    renderItem();
    expect(screen.getByText('Containers')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-containers')).toBeInTheDocument();
  });

  it('hides label text when sidebar is closed for top-level items', () => {
    renderItem({}, false);
    expect(screen.queryByText('Containers')).not.toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-containers')).toBeInTheDocument();
  });

  it('keeps submenu label visible when sidebar is closed', () => {
    renderItem({ isSubMenu: true }, false);
    expect(screen.getByText('Containers')).toBeInTheDocument();
  });

  it('shows badge count and caps at 99+', () => {
    const { rerender } = render(
      <Context.Provider value={{ isOpen: true, toggle: vi.fn() }}>
        <ul>
          {(() => {
            const Wrapped = withTestRouter(SidebarItem);
            return (
              <Wrapped
                to="docker.containers"
                label="Containers"
                data-cy="dockerSidebar-containers"
                count={5}
              />
            );
          })()}
        </ul>
      </Context.Provider>
    );
    expect(screen.getByText('5')).toBeInTheDocument();

    const Wrapped = withTestRouter(SidebarItem);
    rerender(
      <Context.Provider value={{ isOpen: true, toggle: vi.fn() }}>
        <ul>
          <Wrapped
            to="docker.containers"
            label="Containers"
            data-cy="dockerSidebar-containers"
            count={120}
          />
        </ul>
      </Context.Provider>
    );
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not show a zero count badge', () => {
    renderItem({ count: 0 });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
