import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { withEdition } from './withEdition';

function Probe() {
  return <div>edition-on</div>;
}

describe('withEdition', () => {
  it('renders when the process edition matches', () => {
    const CEOnly = withEdition(Probe, 'CE');
    render(<CEOnly />);
    expect(screen.getByText('edition-on')).toBeInTheDocument();
  });

  it('returns null when the process edition does not match', () => {
    const BEOnly = withEdition(Probe, 'BE');
    const { container } = render(<BEOnly />);
    expect(container).toBeEmptyDOMElement();
  });
});
