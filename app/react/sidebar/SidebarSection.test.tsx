import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { Context } from './useSidebarState';
import { SidebarSection, SidebarSectionTitle } from './SidebarSection';

function renderWithState(
  ui: React.ReactElement,
  isOpen: boolean
) {
  return render(
    <Context.Provider value={{ isOpen, toggle: vi.fn() }}>{ui}</Context.Provider>
  );
}

describe('SidebarSection', () => {
  it('renders title and children with string title as aria-label', () => {
    renderWithState(
      <SidebarSection title="Docker">
        <li>child</li>
      </SidebarSection>,
      true
    );

    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByLabelText('Docker')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('uses aria-label prop when title is not a string', () => {
    renderWithState(
      <SidebarSection title={<span>Node</span>} aria-label="env-name" showTitleWhenOpen>
        <li>item</li>
      </SidebarSection>,
      true
    );

    expect(screen.getByLabelText('env-name')).toBeInTheDocument();
  });
});

describe('SidebarSectionTitle', () => {
  it('hides title when sidebar is closed and showWhenOpen is false', () => {
    renderWithState(
      <SidebarSectionTitle>Hidden</SidebarSectionTitle>,
      false
    );

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('shows title when sidebar is closed but showWhenOpen is true', () => {
    renderWithState(
      <SidebarSectionTitle showWhenOpen hoverText="tip">
        Visible
      </SidebarSectionTitle>,
      false
    );

    const title = screen.getByText('Visible');
    expect(title).toBeInTheDocument();
    expect(title).toHaveAttribute('title', 'tip');
  });

  it('shows title when sidebar is open', () => {
    renderWithState(<SidebarSectionTitle>Open</SidebarSectionTitle>, true);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });
});
