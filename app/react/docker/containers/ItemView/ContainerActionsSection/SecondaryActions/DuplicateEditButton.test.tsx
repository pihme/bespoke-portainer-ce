import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReactNode } from 'react';

import { DuplicateEditButton } from './DuplicateEditButton';

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
    className,
  }: {
    children: ReactNode;
    'data-cy'?: string;
    className?: string;
  }) => (
    <a data-cy={dataCy} className={className} href="/">
      {children}
    </a>
  ),
}));

describe('DuplicateEditButton', () => {
  it('renders an enabled duplicate/edit control', () => {
    render(
      <DuplicateEditButton
        containerId="abc"
        nodeName="node-1"
        isPortainer={false}
      />
    );
    const btn = screen.getByTestId('duplicate-edit-container-button');
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent('Duplicate/Edit');
  });

  it('disables the control for the Portainer container', () => {
    render(
      <DuplicateEditButton containerId="abc" isPortainer />
    );
    expect(screen.getByTestId('duplicate-edit-container-button')).toHaveClass('disabled');
  });
});
