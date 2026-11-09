import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StackType } from '@/react/common/stacks/types';

import { TemplateTypeSelector } from './TemplateTypeSelector';

describe('TemplateTypeSelector for local Compose', () => {
  it('selects Standalone / Podman compose type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TemplateTypeSelector
        value={StackType.DockerCompose}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Type/i)).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox'),
      String(StackType.DockerSwarm)
    );
    expect(onChange).toHaveBeenCalledWith(StackType.DockerSwarm);
  });
});
