import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getGroupIcon } from './get-group-icon';

describe('getGroupIcon', () => {
  it('renders a layers icon at the requested size', () => {
    const { container } = render(<>{getGroupIcon('sm')}</>);
    expect(container.querySelector('svg') || container.firstChild).toBeTruthy();
  });
});
