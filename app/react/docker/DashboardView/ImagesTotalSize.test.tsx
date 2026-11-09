import { render, screen } from '@testing-library/react';

import { humanize } from '@/portainer/filters/filters';

import { ImagesTotalSize } from './ImagesTotalSize';

describe('ImagesTotalSize', () => {
  it('renders the humanized total image size', () => {
    const size = 1073741824;
    const humanized = humanize(size);
    if (humanized === undefined) {
      throw new Error('Expected humanize(size) to return a value');
    }

    render(<ImagesTotalSize imagesTotalSize={size} />);

    expect(screen.getByText(humanized)).toBeVisible();
  });
});
