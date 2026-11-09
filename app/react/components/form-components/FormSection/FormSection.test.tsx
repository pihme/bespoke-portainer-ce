import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormSection } from './FormSection';

describe('FormSection', () => {
  it('renders title and children when not foldable', () => {
    render(
      <FormSection title="Networks" id="networks">
        <div>body</div>
      </FormSection>
    );
    expect(screen.getByText('Networks')).toBeVisible();
    expect(screen.getByText('body')).toBeVisible();
  });

  it('starts folded when foldable and expands on click', async () => {
    const user = userEvent.setup();
    const setIsDefaultFolded = vi.fn();
    render(
      <FormSection
        title="Advanced"
        isFoldable
        setIsDefaultFolded={setIsDefaultFolded}
      >
        <div>secret</div>
      </FormSection>
    );

    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('secret')).toBeVisible();
    expect(setIsDefaultFolded).toHaveBeenCalled();
  });

  it('starts expanded when defaultFolded is false', () => {
    render(
      <FormSection title="Open" isFoldable defaultFolded={false}>
        <div>visible</div>
      </FormSection>
    );
    expect(screen.getByText('visible')).toBeVisible();
  });
});
