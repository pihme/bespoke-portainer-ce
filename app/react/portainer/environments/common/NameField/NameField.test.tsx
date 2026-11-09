import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { describe, expect, it, vi } from 'vitest';

import { getEnvironments } from '@/react/portainer/environments/environment.service';

import {
  NameField,
  isNameUnique,
  useNameValidation,
} from './NameField';

vi.mock('@/react/portainer/environments/environment.service', () => ({
  getEnvironments: vi.fn(),
}));

function renderNameField(
  props: {
    readonly?: boolean;
    tooltip?: string;
    placeholder?: string;
    initialName?: string;
  } = {}
) {
  const { initialName = 'docker-prod', ...fieldProps } = props;
  return render(
    <Formik initialValues={{ name: initialName }} onSubmit={() => {}}>
      <NameField {...fieldProps} />
    </Formik>
  );
}

describe('NameField', () => {
  it('renders the name input with default placeholder', () => {
    renderNameField();
    const input = screen.getByTestId('environmentCreate-nameInput');
    expect(input).toBeVisible();
    expect(input).toHaveAttribute(
      'placeholder',
      'e.g. docker-prod01 / kubernetes-cluster01'
    );
    expect(input).toHaveValue('docker-prod');
  });

  it('forwards custom placeholder tooltip and readonly', () => {
    renderNameField({
      placeholder: 'my-env',
      tooltip: 'Friendly name',
      readonly: true,
    });
    const input = screen.getByTestId('environmentCreate-nameInput');
    expect(input).toHaveAttribute('placeholder', 'my-env');
    expect(input).toHaveAttribute('readonly');
    expect(document.querySelector('.lucide-circle-question-mark')).not.toBeNull();
  });

  it('updates the formik value after debounce when typing', async () => {
    const user = userEvent.setup();
    renderNameField({ initialName: '' });
    const input = screen.getByTestId('environmentCreate-nameInput');
    await user.type(input, 'new-env');
    await waitFor(
      () => {
        expect(input).toHaveValue('new-env');
      },
      { timeout: 1000 }
    );
  });
});

describe('isNameUnique', () => {
  it('returns true for empty names without querying', async () => {
    await expect(isNameUnique('')).resolves.toBe(true);
    await expect(isNameUnique()).resolves.toBe(true);
    expect(getEnvironments).not.toHaveBeenCalled();
  });

  it('returns true when no environments match the name', async () => {
    vi.mocked(getEnvironments).mockResolvedValueOnce({
      totalCount: 0,
      value: [],
    } as never);
    await expect(isNameUnique('fresh')).resolves.toBe(true);
  });

  it('returns false when another environment owns the name', async () => {
    vi.mocked(getEnvironments).mockResolvedValueOnce({
      totalCount: 1,
      value: [{ Id: 9, Name: 'taken' }],
    } as never);
    await expect(isNameUnique('taken')).resolves.toBe(false);
  });

  it('returns true when the matching environment is the current one', async () => {
    vi.mocked(getEnvironments).mockResolvedValueOnce({
      totalCount: 1,
      value: [{ Id: 3, Name: 'mine' }],
    } as never);
    await expect(isNameUnique('mine', 3)).resolves.toBe(true);
  });

  it('assumes unique when the backend fails', async () => {
    vi.mocked(getEnvironments).mockRejectedValueOnce(new Error('boom'));
    await expect(isNameUnique('whatever')).resolves.toBe(true);
  });
});

describe('useNameValidation', () => {
  it('requires a name and checks uniqueness', async () => {
    function Probe() {
      const schema = useNameValidation(7);
      return (
        <button
          type="button"
          data-cy="validate"
          onClick={async () => {
            try {
              await schema.validate('');
              document.body.dataset.result = 'ok';
            } catch (e) {
              document.body.dataset.result = (e as Error).message;
            }
          }}
        >
          go
        </button>
      );
    }

    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByTestId('validate'));
    await waitFor(() => {
      expect(document.body.dataset.result).toBe('Name is required');
    });

    vi.mocked(getEnvironments).mockResolvedValueOnce({
      totalCount: 0,
      value: [],
    } as never);

    function ProbeUnique() {
      const schema = useNameValidation();
      return (
        <button
          type="button"
          data-cy="validate-ok"
          onClick={async () => {
            const value = await schema.validate('unique-name');
            document.body.dataset.unique = value;
          }}
        >
          go
        </button>
      );
    }
    render(<ProbeUnique />);
    await user.click(screen.getByTestId('validate-ok'));
    await waitFor(() => {
      expect(document.body.dataset.unique).toBe('unique-name');
    });
  });
});
