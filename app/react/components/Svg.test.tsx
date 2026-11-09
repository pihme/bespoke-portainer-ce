import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Svg from './Svg';

describe('Svg', () => {
  it('renders a known vendor icon', () => {
    const { container } = render(<Svg icon="docker" className="ico" />);
    expect(container.querySelector('.ico')).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('falls back to the placeholder when the icon is missing', () => {
    const { container } = render(
      // cast: exercise the missing-key branch
      <Svg icon={'missing' as 'docker'} className="missing" />
    );
    expect(container.querySelector('.missing')).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
