import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { createMockUser } from '@/react-tools/test-mocks';

import { RuntimeSection } from './RuntimeSection';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('./RuntimeSelector', () => ({
  RuntimeSelector: ({
    onChange,
  }: {
    onChange: (value: string) => void;
  }) => (
    <button type="button" onClick={() => onChange('runc')}>
      pick-runtime
    </button>
  ),
}));

describe('REQ-CTR-03 RuntimeSection', () => {
  it('toggles privileged/init and picks a runtime type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const Wrapped = withTestQueryProvider(
      withUserProvider(
        () => (
          <RuntimeSection
            values={{ privileged: false, init: false, type: '' }}
            onChange={onChange}
            allowPrivilegedMode
            isInitFieldVisible
          />
        ),
        createMockUser()
      )
    );
    render(<Wrapped />);

    await user.click(screen.getByText('Privileged mode'));
    expect(onChange).toHaveBeenCalledWith({
      privileged: true,
      init: false,
      type: '',
    });

    await user.click(screen.getByText('Init'));
    expect(onChange).toHaveBeenCalledWith({
      privileged: false,
      init: true,
      type: '',
    });

    await user.click(screen.getByRole('button', { name: 'pick-runtime' }));
    expect(onChange).toHaveBeenCalledWith({
      privileged: false,
      init: false,
      type: 'runc',
    });
  });
});
