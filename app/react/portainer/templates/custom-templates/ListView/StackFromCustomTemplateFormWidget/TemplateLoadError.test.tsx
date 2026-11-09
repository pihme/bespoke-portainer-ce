import { render, screen } from '@testing-library/react';

import { TemplateLoadError } from './TemplateLoadError';

const useCurrentUser = vi.fn();
const useIsEdgeAdmin = vi.fn();

vi.mock('@/react/hooks/useUser', () => ({
  useCurrentUser: (...args: unknown[]) => useCurrentUser(...args),
  useIsEdgeAdmin: (...args: unknown[]) => useIsEdgeAdmin(...args),
}));
vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('@@/form-components/FormError', () => ({
  FormError: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('TemplateLoadError', () => {
  beforeEach(() => {
    useCurrentUser.mockReset();
    useIsEdgeAdmin.mockReset();
  });

  it('returns null while admin status loads', () => {
    useCurrentUser.mockReturnValue({ user: { Id: 2 } });
    useIsEdgeAdmin.mockReturnValue({ isAdmin: false, isLoading: true });
    const { container } = render(
      <TemplateLoadError templateId={9} creatorId={1} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('links admins to the edit page', () => {
    useCurrentUser.mockReturnValue({ user: { Id: 99 } });
    useIsEdgeAdmin.mockReturnValue({ isAdmin: true, isLoading: false });
    render(<TemplateLoadError templateId={9} creatorId={1} />);
    expect(screen.getByText('click here')).toBeVisible();
  });

  it('links the template creator to the edit page', () => {
    useCurrentUser.mockReturnValue({ user: { Id: 1 } });
    useIsEdgeAdmin.mockReturnValue({ isAdmin: false, isLoading: false });
    render(<TemplateLoadError templateId={9} creatorId={1} />);
    expect(screen.getByText('click here')).toBeVisible();
  });

  it('asks other users to contact an administrator', () => {
    useCurrentUser.mockReturnValue({ user: { Id: 2 } });
    useIsEdgeAdmin.mockReturnValue({ isAdmin: false, isLoading: false });
    render(<TemplateLoadError templateId={9} creatorId={1} />);
    expect(
      screen.getByText(/please contact your administrator/i)
    ).toBeVisible();
  });
});
