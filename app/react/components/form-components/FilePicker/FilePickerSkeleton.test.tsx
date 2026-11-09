import { render } from '@testing-library/react';

import { FilePickerSkeleton } from './FilePickerSkeleton';

describe('FilePickerSkeleton', () => {
  it('renders the loading placeholder layout', () => {
    const { container } = render(<FilePickerSkeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
    // Eight skeleton tree rows plus the filter/footer placeholders
    expect(container.querySelectorAll('.animate-pulse .h-8').length).toBeGreaterThan(0);
  });
});
