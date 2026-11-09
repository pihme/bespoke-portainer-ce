import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { createMockUser } from '@/react-tools/test-mocks';

import { EnvironmentTypeSelectView } from './EnvironmentTypeSelectView';
import {
  environmentTypes,
  existingEnvironmentTypes,
  formTitles,
  newEnvironmentTypes,
} from './environment-types';
import { EnvironmentSelector } from './EnvironmentSelector';

const go = vi.fn();

vi.mock('@uirouter/react', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ stateService: { go } }),
}));

function renderView() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(EnvironmentTypeSelectView), createMockUser())
  );
  return render(<Wrapped />);
}

describe('REQ-ENV-04 EnvironmentTypeSelectView', () => {
  beforeEach(() => {
    go.mockClear();
  });

  it('renders the wizard chrome and Docker Standalone option', () => {
    renderView();

    expect(screen.getByText('Quick Setup')).toBeVisible();
    expect(screen.getAllByText('Environment Wizard').length).toBeGreaterThan(0);
    expect(screen.getByText('Connect to existing environments')).toBeVisible();
    expect(screen.getByText('Set up new environments')).toBeVisible();
    expect(
      screen.getByLabelText(/Docker Standalone/i, { exact: false })
    ).toBeInTheDocument();
  });

  it('keeps Start Wizard disabled until a type is selected', () => {
    renderView();

    const start = screen.getByTestId('start-wizard-button');
    expect(start).toBeDisabled();
    fireEvent.click(start);
    expect(go).not.toHaveBeenCalled();
  });

  it('starts the wizard with the selected Docker Standalone type', () => {
    renderView();

    fireEvent.click(
      screen.getByLabelText(/Docker Standalone/i, { exact: false })
    );

    const start = screen.getByTestId('start-wizard-button');
    expect(start).not.toBeDisabled();
    fireEvent.click(start);

    expect(go).toHaveBeenCalledWith('portainer.wizard.endpoints.create', {
      envType: ['dockerStandalone'],
    });
  });
});

describe('environment-types local Docker options', () => {
  it('exposes Docker Standalone among existing types and titles', () => {
    expect(
      existingEnvironmentTypes.some((t) => t.value === 'dockerStandalone')
    ).toBe(true);
    expect(formTitles.dockerStandalone).toMatch(/Docker Standalone/);
    expect(environmentTypes.length).toBe(
      existingEnvironmentTypes.length + newEnvironmentTypes.length
    );
  });
});

describe('EnvironmentSelector', () => {
  it('forwards options to BoxSelector including hidden spacing', () => {
    const onChange = vi.fn();
    render(
      <EnvironmentSelector
        value={[]}
        onChange={onChange}
        options={existingEnvironmentTypes.filter(
          (t) => t.value === 'dockerStandalone'
        )}
        hiddenSpacingCount={2}
      />
    );

    fireEvent.click(
      screen.getByLabelText(/Docker Standalone/i, { exact: false })
    );
    expect(onChange).toHaveBeenCalled();
  });
});
