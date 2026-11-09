import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { FeatureId } from '@/react/portainer/feature-flags/enums';

import { ForceDeploymentSwitch } from './ForceDeploymentSwitch';

vi.mock('@@/form-components/SwitchField', () => ({
  SwitchField: ({
    checked,
    onChange,
    label,
    featureId,
    name,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    featureId?: string;
    name: string;
  }) => (
    <button
      type="button"
      data-cy={`switch-${name}`}
      data-feature={featureId}
      data-checked={String(checked)}
      onClick={() => onChange(!checked)}
    >
      {label}
    </button>
  ),
}));

describe('ForceDeploymentSwitch', () => {
  it('renders default label and forwards toggle', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ForceDeploymentSwitch checked={false} onChange={onChange} />);
    const btn = screen.getByTestId('switch-forceUpdate');
    expect(btn).toHaveTextContent('Force redeployment');
    expect(btn).toHaveAttribute('data-feature', FeatureId.FORCE_REDEPLOYMENT);
    await user.click(btn);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('uses a custom label when provided', () => {
    render(
      <ForceDeploymentSwitch
        checked
        onChange={vi.fn()}
        label="Always apply manifest"
      />
    );
    expect(screen.getByTestId('switch-forceUpdate')).toHaveTextContent(
      'Always apply manifest'
    );
  });
});
