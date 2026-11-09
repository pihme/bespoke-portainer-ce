import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { server } from '@/setup-tests/server';

import { Source } from './types';
import { GitSourceSelector } from './GitSourceSelector';

function renderComponent({
  value,
  sources = [],
}: {
  value?: Source['id'];
  sources?: Array<Pick<Source, 'id' | 'name'>>;
} = {}) {
  server.use(
    http.get('/api/gitops/sources', () =>
      HttpResponse.json(sources, {
        headers: {
          'x-total-count': String(sources.length),
          'x-total-available': String(sources.length),
        },
      })
    )
  );

  const Wrapped = withTestQueryProvider(
    withTestRouter(() => <GitSourceSelector value={value} onChange={vi.fn()} />)
  );

  return render(<Wrapped />);
}

describe('GitSourceSelector', () => {
  it('renders the source selector', async () => {
    renderComponent();

    expect(await screen.findByLabelText('Source')).toBeInTheDocument();
  });

  it('shows the create new source button', async () => {
    renderComponent();

    expect(
      await screen.findByTestId('create-source-button')
    ).toBeInTheDocument();
  });
});

describe('GitSourceSelector selection', () => {
  it('shows the selected source name', async () => {
    renderComponent({
      value: 2,
      sources: [
        { id: 1, name: 'alpha' },
        { id: 2, name: 'beta' },
      ],
    });

    expect(await screen.findByText('beta')).toBeInTheDocument();
  });

  it('lists available sources in the menu', async () => {
    const user = userEvent.setup();
    renderComponent({
      sources: [
        { id: 1, name: 'alpha' },
        { id: 2, name: 'beta' },
      ],
    });

    const input = await screen.findByLabelText('Source');
    await user.click(input);
    expect(await screen.findByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('shows no-options message when there are no git sources', async () => {
    const user = userEvent.setup();
    renderComponent({ sources: [] });
    const input = await screen.findByLabelText('Source');
    await user.click(input);
    expect(
      await screen.findByText('No git sources available')
    ).toBeInTheDocument();
  });
});
