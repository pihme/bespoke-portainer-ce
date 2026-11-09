import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { TLSFieldset, tlsConfigValidation } from './TLSFieldset';
import { TLSConfig } from './types';

vi.mock('@@/form-components/SwitchField', () => ({
  SwitchField: ({
    checked,
    onChange,
    label,
    'data-cy': dataCy,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    'data-cy'?: string;
  }) => (
    <button type="button" data-cy={dataCy} onClick={() => onChange(!checked)}>
      {label}:{String(checked)}
    </button>
  ),
}));

vi.mock('@@/form-components/FormControl', () => ({
  FormControl: ({
    label,
    children,
    errors,
  }: {
    label: string;
    children: React.ReactNode;
    errors?: string;
  }) => (
    <div>
      <span>{label}</span>
      {errors ? <span data-cy="err">{errors}</span> : null}
      {children}
    </div>
  ),
}));

vi.mock('@@/form-components/FileUpload', () => ({
  FileUploadField: ({
    'data-cy': dataCy,
    onChange,
  }: {
    'data-cy'?: string;
    onChange: (f: File) => void;
  }) => (
    <button
      type="button"
      data-cy={dataCy}
      onClick={() => onChange(new File(['x'], 'cert.pem'))}
    >
      upload
    </button>
  ),
}));

describe('TLSFieldset', () => {
  it('toggles TLS and reveals skip-verify', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const values: TLSConfig = { tls: false };
    const { rerender } = render(
      <TLSFieldset values={values} onChange={onChange} />
    );
    await user.click(screen.getByTestId('enable-tls-switch'));
    expect(onChange).toHaveBeenCalledWith({ tls: true });

    rerender(
      <TLSFieldset values={{ tls: true, skipVerify: false }} onChange={onChange} />
    );
    expect(screen.getByTestId('skip-verify-switch')).toBeVisible();
    expect(screen.getByText('TLS CA certificate')).toBeVisible();
    await user.click(screen.getByTestId('ca-cert-file-upload'));
    expect(onChange).toHaveBeenCalledWith({
      caCertFile: expect.any(File),
    });
    await user.click(screen.getByTestId('cert-file-upload'));
    expect(onChange).toHaveBeenCalledWith({ certFile: expect.any(File) });
    await user.click(screen.getByTestId('tls-key-file-upload'));
    expect(onChange).toHaveBeenCalledWith({ keyFile: expect.any(File) });
  });

  it('hides cert uploads when skipVerify is on', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TLSFieldset
        values={{ tls: true, skipVerify: true }}
        onChange={onChange}
      />
    );
    expect(screen.queryByText('TLS CA certificate')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('skip-verify-switch'));
    expect(onChange).toHaveBeenCalledWith({ skipVerify: false });
  });

  it('surfaces file field errors', () => {
    render(
      <TLSFieldset
        values={{ tls: true, skipVerify: false }}
        onChange={vi.fn()}
        errors={{ caCertFile: 'File is required' }}
      />
    );
    expect(screen.getByTestId('err')).toHaveTextContent('File is required');
  });
});

describe('tlsConfigValidation', () => {
  it('accepts TLS off by default', async () => {
    await expect(tlsConfigValidation().validate({})).resolves.toMatchObject({
      tls: false,
      skipVerify: false,
    });
  });

  it('requires cert files when TLS is on without skipVerify', async () => {
    await expect(
      tlsConfigValidation().validate({ tls: true, skipVerify: false })
    ).rejects.toThrow(/required/i);
  });

  it('allows missing certs when optionalCert is set', async () => {
    await expect(
      tlsConfigValidation({ optionalCert: true }).validate({
        tls: true,
        skipVerify: false,
      })
    ).resolves.toMatchObject({ tls: true });
  });

  it('skips cert requirement when skipVerify is true', async () => {
    await expect(
      tlsConfigValidation().validate({ tls: true, skipVerify: true })
    ).resolves.toMatchObject({ tls: true, skipVerify: true });
  });
});
