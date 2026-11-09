import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EnvironmentHealth } from '@/react/portainer/environments/types';

import { getHealthIcon } from './get-health-icon';

describe('getHealthIcon', () => {
  it('renders Up and Down health dots for local environments', () => {
    const { container, rerender } = render(
      <>{getHealthIcon(EnvironmentHealth.Up, 'sm')}</>
    );
    expect(container.querySelector('.bg-success-7')).toBeTruthy();

    rerender(<>{getHealthIcon(EnvironmentHealth.Down, 'md')}</>);
    expect(container.querySelector('.bg-error-7')).toBeTruthy();
  });
});
