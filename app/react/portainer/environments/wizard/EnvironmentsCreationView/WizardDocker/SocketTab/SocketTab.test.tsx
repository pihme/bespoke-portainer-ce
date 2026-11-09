import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../APITab/DeploymentScripts', () => ({
  DeploymentScripts: () => <div>scripts</div>,
}));

vi.mock('./SocketForm', () => ({
  SocketForm: () => <div data-cy="socket-form">socket form</div>,
}));

import { SocketTab } from './SocketTab';

describe('SocketTab', () => {
  it('renders deployment scripts and the socket form', () => {
    render(<SocketTab onCreate={() => {}} />);
    expect(screen.getByText('scripts')).toBeVisible();
    expect(screen.getByTestId('socket-form')).toBeVisible();
  });
});
