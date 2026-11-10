import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';

import { ListView } from './ListView';

vi.mock('./PullImageFormWidget', () => ({
  PullImageFormWidget: (props: object) => (
    <div data-cy="pull-image-form-widget">
      PullImageFormWidget - props: [{Object.keys(props).join(',')}]
    </div>
  ),
}));
vi.mock('./ImagesDatatable/ImagesDatatable', () => ({
  ImagesDatatable: (props: object) => (
    <div data-cy="images-datatable">
      ImagesDatatable - props: [{Object.keys(props).join(',')}]
    </div>
  ),
}));

describe('ListView', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    it('should render all main sections', async () => {
      renderComponent();

      // PageHeader with title
      expect(
        screen.getByRole('heading', { name: /image list/i })
      ).toBeVisible();

      // PullImageFormWidget
      expect(screen.getByTestId('pull-image-form-widget')).toBeVisible();

      // ImagesDatatable
      expect(screen.getByTestId('images-datatable')).toBeVisible();
    });
  });

  describe('REQ-TAI-003 / REQ-TAI-007 Swarm and per-node targeting are removed', () => {
    it('has no node selector or host column switch at all', async () => {
      renderComponent();

      expect(screen.getByTestId('pull-image-form-widget')).toHaveTextContent(
        'props: []'
      );
      expect(screen.getByTestId('images-datatable')).toHaveTextContent(
        'props: []'
      );
    });
  });
});

function renderComponent() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(ListView))
  );
  return render(<Wrapped />);
}
