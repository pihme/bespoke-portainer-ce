import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SnapshotBadge } from './SnapshotBadge';

describe('SnapshotBadge', () => {
  it('shows that a snapshot is available', () => {
    render(<SnapshotBadge />);
    expect(screen.getByLabelText('status-badge')).toHaveTextContent(
      'Snapshot available'
    );
  });
});
