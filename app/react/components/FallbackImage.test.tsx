import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FallbackImage } from './FallbackImage';

describe('FallbackImage', () => {
  it('shows the fallback while loading and hides it after load', () => {
    render(
      <FallbackImage
        src="https://example.com/logo.png"
        alt="logo"
        fallbackIcon={<span>FB</span>}
        className="img"
      />
    );
    expect(screen.getByText('FB')).toBeVisible();
    const img = screen.getByRole('img', { name: 'logo', hidden: true });
    fireEvent.load(img);
    expect(screen.queryByText('FB')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'logo' })).toBeVisible();
  });

  it('keeps the fallback when the image errors', () => {
    render(
      <FallbackImage
        src="https://example.com/broken.png"
        alt="broken"
        fallbackIcon={<span>FB</span>}
      />
    );
    fireEvent.error(screen.getByRole('img', { name: 'broken', hidden: true }));
    expect(screen.getByText('FB')).toBeVisible();
    expect(screen.queryByRole('img', { name: 'broken' })).not.toBeInTheDocument();
  });

  it('renders only the fallback when src is missing', () => {
    render(<FallbackImage fallbackIcon={<span>Only</span>} />);
    expect(screen.getByText('Only')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
