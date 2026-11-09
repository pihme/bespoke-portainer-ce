import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-cy="rq-devtools">devtools</div>,
}));

import { ReactQueryDevtoolsWrapper } from './ReactQueryDevtoolsWrapper';

describe('ReactQueryDevtoolsWrapper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders nothing when the env flag is off', () => {
    vi.stubEnv('SHOW_REACT_QUERY_DEV_TOOLS', 'false');
    const { container } = render(<ReactQueryDevtoolsWrapper />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the devtools when the env flag is true', () => {
    vi.stubEnv('SHOW_REACT_QUERY_DEV_TOOLS', 'true');
    const { getByText } = render(<ReactQueryDevtoolsWrapper />);
    expect(getByText('devtools')).toBeVisible();
  });
});
