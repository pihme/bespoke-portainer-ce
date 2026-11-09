import { render, screen } from '@testing-library/react';

import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { EditView } from './EditView';

const useCustomTemplate = vi.fn();
const useViewType = vi.fn(() => 'docker');

vi.mock('@uirouter/react', () => ({
  useCurrentStateAndParams: () => ({ params: { id: 7 } }),
}));
vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));
vi.mock('../queries/useCustomTemplate', () => ({
  useCustomTemplate: (...args: unknown[]) => useCustomTemplate(...args),
}));
vi.mock('../useViewType', () => ({
  useViewType: (...args: unknown[]) => useViewType(...args),
}));
vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('@@/Widget', () => {
  function Widget({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }
  Widget.Body = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return { Widget };
});
vi.mock('./EditForm', () => ({
  EditForm: ({ template }: { template: { Title: string } }) => (
    <div data-cy="edit-form">{template.Title}</div>
  ),
}));

describe('REQ-TPL-03 EditView for local Compose templates', () => {
  it('returns null while the template is loading', () => {
    useCustomTemplate.mockReturnValue({ data: undefined });
    const { container } = render(<EditView />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the edit form for a loaded template', () => {
    useCustomTemplate.mockReturnValue({
      data: {
        Id: 7,
        Title: 'Nginx',
        Type: StackType.DockerCompose,
        Platform: Platform.LINUX,
      },
    });
    render(<EditView />);
    expect(screen.getByText('Edit Custom template')).toBeVisible();
    expect(screen.getByTestId('edit-form')).toHaveTextContent('Nginx');
  });
});
