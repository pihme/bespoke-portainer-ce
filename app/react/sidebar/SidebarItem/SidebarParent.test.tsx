import { render, screen, fireEvent } from '@testing-library/react';
import { Edit } from 'lucide-react';
import { vi } from 'vitest';

import { withTestRouter } from '@/react/test-utils/withRouter';

import { Context } from '../useSidebarState';

import { SidebarParent } from './SidebarParent';

vi.mock('./useSidebarSrefActive', () => ({
  useSidebarSrefActive: () => ({
    href: '#/docker/templates',
    onClick: vi.fn(),
    className: '',
  }),
}));

function renderParent(isOpen = true, activeClass = '') {
  vi.doMock('./useSidebarSrefActive', () => ({
    useSidebarSrefActive: () => ({
      href: '#/docker/templates',
      onClick: vi.fn(),
      className: activeClass,
    }),
  }));

  const Wrapped = withTestRouter(SidebarParent);
  return render(
    <Context.Provider value={{ isOpen, toggle: vi.fn() }}>
      <ul>
        <Wrapped
          icon={Edit}
          label="Templates"
          to="docker.templates"
          data-cy="portainerSidebar-templates"
          listId="dockerSidebar-templates"
        >
          <li>child-item</li>
        </Wrapped>
      </ul>
    </Context.Provider>
  );
}

describe('SidebarParent', () => {
  it('renders parent label and collapsed child list when open', () => {
    renderParent(true);
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-templates')).toBeInTheDocument();
    const list = document.getElementById('dockerSidebar-templates');
    expect(list).toHaveClass('hidden');
  });

  it('expands child list when expand button is clicked', () => {
    renderParent(true);
    fireEvent.click(screen.getByTestId('expand-button'));
    const list = document.getElementById('dockerSidebar-templates');
    expect(list).toHaveClass('block');
    expect(screen.getByText('child-item')).toBeInTheDocument();
  });

  it('expands when parent link area is clicked', () => {
    renderParent(true);
    fireEvent.click(screen.getByTestId('portainerSidebar-templates-link'));
    expect(document.getElementById('dockerSidebar-templates')).toHaveClass(
      'block'
    );
  });

  it('hides expand button and parent label text when sidebar is closed', () => {
    renderParent(false);
    expect(screen.queryByTestId('expand-button')).not.toBeInTheDocument();
    expect(screen.queryByText('Templates')).not.toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-templates')).toBeInTheDocument();
  });
});
