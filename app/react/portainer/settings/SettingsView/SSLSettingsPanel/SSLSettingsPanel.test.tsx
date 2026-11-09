import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

const notifySuccess = vi.fn();

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

import { SSLSettingsPanelWrapper } from './SSLSettingsPanel';

const sslDefaults = {
  certPath: '/data/certs/cert.pem',
  keyPath: '/data/certs/key.pem',
  caCertPath: '',
  selfSigned: true,
  httpEnabled: true,
};

function mockApis(
  overrides: {
    ssl?: Partial<typeof sslDefaults>;
    forceSecureCookies?: boolean;
  } = {}
) {
  const ssl = { ...sslDefaults, ...overrides.ssl };
  server.use(
    http.get('/api/ssl', () => HttpResponse.json(ssl)),
    http.put('/api/ssl', async () => HttpResponse.json(null)),
    http.get('/api/settings', () =>
      HttpResponse.json({
        ForceSecureCookies: overrides.forceSecureCookies ?? false,
      })
    ),
    http.put('/api/settings', async () =>
      HttpResponse.json({
        ForceSecureCookies: overrides.forceSecureCookies ?? false,
      })
    )
  );
}

function renderPanel() {
  const Wrapped = withTestQueryProvider(SSLSettingsPanelWrapper);
  return render(<Wrapped />);
}

describe('REQ-SET-04 SSLSettingsPanel', () => {
  const originalDdExtension = window.ddExtension;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notifySuccess.mockClear();
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
    delete (window as { ddExtension?: boolean }).ddExtension;
  });

  afterEach(() => {
    if (originalDdExtension === undefined) {
      delete (window as { ddExtension?: boolean }).ddExtension;
    } else {
      window.ddExtension = originalDdExtension;
    }
    vi.useRealTimers();
  });

  it('renders nothing while SSL or settings queries are loading', () => {
    server.use(
      http.get('/api/ssl', () => new Promise(() => {})),
      http.get('/api/settings', () => new Promise(() => {}))
    );

    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the panel when Portainer runs as a Docker extension', async () => {
    window.ddExtension = true;
    mockApis();
    const { container } = renderPanel();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders the SSL certificate form when settings load', async () => {
    mockApis({ forceSecureCookies: true });
    renderPanel();

    expect(
      await screen.findByRole('heading', { name: /ssl certificate/i })
    ).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: /force https only/i })
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /force secure cookies/i })
    ).toBeChecked();
    expect(
      screen.getByRole('button', { name: /save ssl settings/i })
    ).toBeDisabled();
  });

  it('updates ForceSecureCookies without touching SSL when only cookies change', async () => {
    const user = userEvent.setup();
    let settingsBody: unknown;
    mockApis();
    server.use(
      http.put('/api/settings', async ({ request }) => {
        settingsBody = await request.json();
        return HttpResponse.json(settingsBody);
      }),
      http.put('/api/ssl', () => {
        throw new Error('SSL should not be updated');
      })
    );

    renderPanel();
    const cookies = await screen.findByRole('checkbox', {
      name: /force secure cookies/i,
    });
    await user.click(cookies);

    const save = screen.getByRole('button', { name: /save ssl settings/i });
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith(
        'Success',
        'Security settings updated'
      )
    );
    expect(settingsBody).toEqual({ ForceSecureCookies: true });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('forces HTTPS, waits for SSL save, then reloads the page', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    let sslBody: unknown;
    mockApis({ ssl: { httpEnabled: true } });
    server.use(
      http.put('/api/ssl', async ({ request }) => {
        sslBody = await request.json();
        return HttpResponse.json(null);
      }),
      http.put('/api/settings', async () =>
        HttpResponse.json({ ForceSecureCookies: false })
      )
    );

    renderPanel();

    const https = await screen.findByRole('checkbox', {
      name: /force https only/i,
    });
    await user.click(https);

    const save = screen.getByRole('button', { name: /save ssl settings/i });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => expect(sslBody).toBeTruthy());
    expect(sslBody).toMatchObject({
      httpEnabled: false,
    });

    await vi.advanceTimersByTimeAsync(10000);
    await waitFor(() => expect(reloadSpy).toHaveBeenCalled());
    expect(
      await screen.findByRole('button', { name: /reloading/i })
    ).toBeInTheDocument();
  });

  it('accepts certificate and key uploads before save', async () => {
    const user = userEvent.setup();
    let sslBody: unknown;
    mockApis();
    server.use(
      http.put('/api/ssl', async ({ request }) => {
        sslBody = await request.json();
        return HttpResponse.json(null);
      }),
      http.put('/api/settings', async () =>
        HttpResponse.json({ ForceSecureCookies: false })
      )
    );

    if (!(File.prototype as { text?: () => Promise<string> }).text) {
      File.prototype.text = async function text(this: File) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsText(this);
        });
      };
    }

    renderPanel();
    await screen.findByRole('heading', { name: /ssl certificate/i });

    const certInput = document.querySelector(
      'input[data-cy="ssl-cert-file-upload-input"]'
    ) as HTMLInputElement;
    const keyInput = document.querySelector(
      'input[data-cy="ssl-key-file-upload-input"]'
    ) as HTMLInputElement;

    const cert = new File(['CERT'], 'server.pem', { type: 'text/plain' });
    const key = new File(['KEY'], 'server.key', { type: 'text/plain' });
    await user.upload(certInput, cert);
    await user.upload(keyInput, key);

    const save = screen.getByRole('button', { name: /save ssl settings/i });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => expect(sslBody).toBeTruthy());
    expect(sslBody).toMatchObject({
      cert: 'CERT',
      key: 'KEY',
      httpEnabled: true,
    });
  });

  it('marks forceHTTPS from httpEnabled=false on load', async () => {
    mockApis({ ssl: { httpEnabled: false } });
    renderPanel();

    expect(
      await screen.findByRole('checkbox', { name: /force https only/i })
    ).toBeChecked();
  });
});
