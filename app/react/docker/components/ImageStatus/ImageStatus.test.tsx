import { render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const useEnvironment = vi.fn();
const useImageNotification = vi.fn();

vi.mock('@/react/portainer/environments/queries', () => ({
  useEnvironment: (...args: unknown[]) => useEnvironment(...args),
}));

vi.mock('./useImageNotification', () => ({
  useImageNotification: (...args: unknown[]) => useImageNotification(...args),
}));

vi.mock('@/react/portainer/feature-flags/feature-flags.service', () => ({
  isBE: true,
}));

import { ImageStatus } from './ImageStatus';
import { ResourceType } from './types';

describe('ImageStatus widget for local Docker images', () => {
  beforeEach(() => {
    useEnvironment.mockReset();
    useImageNotification.mockReset();
  });

  it('renders nothing when notifications are disabled or the query errors', () => {
    useEnvironment.mockReturnValue({ data: false });
    useImageNotification.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    const { container, rerender } = render(
      <ImageStatus environmentId={1} resourceId="c1" />
    );
    expect(container).toBeEmptyDOMElement();

    useEnvironment.mockReturnValue({ data: true });
    useImageNotification.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    rerender(<ImageStatus environmentId={1} resourceId="c1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a spinner while loading and an icon when status data arrives', () => {
    useEnvironment.mockReturnValue({ data: true });
    useImageNotification.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    const { rerender } = render(
      <ImageStatus
        environmentId={1}
        resourceId="c1"
        resourceType={ResourceType.CONTAINER}
        nodeName="n1"
      />
    );
    expect(document.querySelector('.animate-spin-slow')).toBeTruthy();

    useImageNotification.mockReturnValue({
      data: { Status: 'updated', Message: 'ok' },
      isLoading: false,
      isError: false,
    });
    rerender(<ImageStatus environmentId={1} resourceId="c1" />);
    // Icon renders an svg / img for up-to-date
    expect(document.querySelector('svg, img')).toBeTruthy();
  });
});
