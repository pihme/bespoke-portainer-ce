import { render, screen } from '@testing-library/react';
import { GitCommit } from 'lucide-react';

import { StatBlock } from './StatBlock';

describe('REQ-GIT-02 StatBlock', () => {
  it('renders the label and value', () => {
    render(<StatBlock icon={GitCommit} label="Workflows" value={3} />);

    expect(screen.getByText('Workflows')).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
  });
});
