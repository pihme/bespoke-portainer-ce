import { render, screen } from '@testing-library/react';
import { Formik, Form } from 'formik';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  PortainerTunnelAddrField,
  validation as tunnelValidation,
  buildDefaultValue as buildTunnelDefault,
} from './PortainerTunnelAddrField';
import {
  PortainerUrlField,
  validation as urlValidation,
  buildDefaultValue as buildUrlDefault,
} from './PortainerUrlField';

describe('PortainerTunnelAddrField helpers', () => {
  it('requires a non-localhost tunnel address', async () => {
    const schema = tunnelValidation();
    await expect(schema.validate('edge.example.com')).resolves.toBe(
      'edge.example.com'
    );
    await expect(schema.validate('')).rejects.toThrow(
      /Tunnel server address is required/
    );
    await expect(schema.validate('localhost')).rejects.toThrow(
      /valid address/
    );
    await expect(schema.validate(undefined)).rejects.toThrow();
  });

  it('builds a default tunnel address from window.location', () => {
    expect(buildTunnelDefault()).toBe(`${window.location.hostname}:8000`);
  });

  it('renders the tunnel address field inside Formik', () => {
    render(
      <Formik initialValues={{ tunnel: '' }} onSubmit={() => {}}>
        <Form>
          <PortainerTunnelAddrField fieldName="tunnel" required readonly />
        </Form>
      </Formik>
    );
    expect(
      screen.getByLabelText(/Portainer tunnel server address/)
    ).toBeInTheDocument();
  });
});

describe('PortainerUrlField helpers', () => {
  it('requires a non-localhost API URL', async () => {
    const schema = urlValidation();
    await expect(
      schema.validate('https://portainer.example.com')
    ).resolves.toBe('https://portainer.example.com');
    await expect(schema.validate('')).rejects.toThrow(/API server URL is required/);
    await expect(schema.validate('http://localhost:9000')).rejects.toThrow(
      /valid URL/
    );
  });

  it('builds a default API URL from window.location', () => {
    expect(buildUrlDefault()).toBe(
      `${window.location.protocol}//${window.location.host}`
    );
  });

  it('renders the API URL field with a custom tooltip', () => {
    render(
      <Formik initialValues={{ url: '' }} onSubmit={() => {}}>
        <Form>
          <PortainerUrlField
            fieldName="url"
            required
            tooltip="Custom tip"
            readonly
          />
        </Form>
      </Formik>
    );
    expect(
      screen.getByTestId('endpointCreate-portainerServerUrlInput')
    ).toBeInTheDocument();
  });
});
