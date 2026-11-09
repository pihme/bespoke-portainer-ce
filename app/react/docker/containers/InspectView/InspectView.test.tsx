import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InspectView } from './InspectView';

const inspectState = vi.hoisted(() => ({
  data: undefined as undefined | { Name: string; Id: string },
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@uirouter/react', () => ({
  useCurrentStateAndParams: () => ({
    params: { id: 'c1', nodeName: '' },
  }),
}));

vi.mock('../queries/useContainerInspect', () => ({
  useContainerInspect: () => ({ data: inspectState.data }),
}));

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@@/JsonTree', () => ({
  JsonTree: ({ data }: { data: unknown }) => (
    <div data-cy="json-tree">{JSON.stringify(data)}</div>
  ),
}));

vi.mock('@@/Code', () => ({
  Code: ({ children }: { children: React.ReactNode }) => (
    <pre data-cy="code">{children}</pre>
  ),
}));

describe('InspectView', () => {
  it('returns null while inspect data is loading', () => {
    inspectState.data = undefined;
    const { container } = render(<InspectView />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders tree and text inspect views for a local container', async () => {
    const user = userEvent.setup();
    inspectState.data = { Name: '/nginx', Id: 'abc' };
    render(<InspectView />);
    expect(screen.getByText('Container inspect')).toBeVisible();
    expect(screen.getByTestId('json-tree')).toBeVisible();

    await user.click(screen.getByRole('radio', { name: /text/i }));
    expect(screen.getByTestId('code')).toHaveTextContent('"Name": "/nginx"');
  });
});
