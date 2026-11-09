import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => <a data-cy={dataCy}>{children}</a>,
}));

import { name } from './name';

describe('networks name column', () => {
  it('renders truncated name link and System badge when ResourceControl.System', () => {
    const cell = name.cell!({
      row: {
        original: {
          Id: '1',
          Name: 'my-network',
          NodeName: '',
          ResourceControl: { System: true },
        },
      },
    } as never);

    render(<>{cell}</>);
    expect(screen.getByText('my-network')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });
});
