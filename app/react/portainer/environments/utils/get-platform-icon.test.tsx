import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  EnvironmentType,
  PlatformType,
} from '@/react/portainer/environments/types';

import {
  getPlatformIconByEnvironment,
  getPlatformIconByPlatform,
} from './get-platform-icon';

describe('get-platform-icon KEEP docker', () => {
  it('returns docker icons for docker environments and platforms', () => {
    expect(
      getPlatformIconByEnvironment(EnvironmentType.Docker)
    ).toBeTruthy();

    render(<>{getPlatformIconByPlatform(PlatformType.Docker, 'sm')}</>);
    expect(screen.getByRole('img', { name: 'Docker' })).toBeInTheDocument();
  });
});
