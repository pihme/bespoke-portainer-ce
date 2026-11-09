import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import { vi } from 'vitest';

import { withTestRouter } from '@/react/test-utils/withRouter';

import { Context } from '../useSidebarState';

import { Head } from './Head';

const stateName = { current: 'docker.containers' };

vi.mock('@uirouter/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uirouter/react')>();
  return {
    ...actual,
    useCurrentStateAndParams: () => ({
      state: { name: stateName.current },
      params: {},
    }),
    useSrefActive: () => ({
      href: '#/home',
      onClick: vi.fn(),
      className: 'bg-blue-8',
    }),
  };
});

function renderHead(isOpen = true, ignorePaths: string[] = []) {
  const Wrapped = withTestRouter(Head);
  return render(
    <Context.Provider value={{ isOpen, toggle: vi.fn() }}>
      <Wrapped
        to="portainer.home"
        label="Home"
        icon={Home}
        data-cy="portainerSidebar-home"
        ignorePaths={ignorePaths}
      />
    </Context.Provider>
  );
}

describe('SidebarItem Head', () => {
  beforeEach(() => {
    stateName.current = 'docker.containers';
  });

  it('renders label when open', () => {
    renderHead(true);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-home')).toHaveClass('bg-blue-8');
  });

  it('hides label when closed', () => {
    renderHead(false);
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-home')).toBeInTheDocument();
  });

  it('clears active class when current state matches ignorePaths', () => {
    stateName.current = 'docker.templates.custom';
    renderHead(true, ['docker.templates.custom']);
    expect(screen.getByTestId('portainerSidebar-home')).not.toHaveClass(
      'bg-blue-8'
    );
  });
});
