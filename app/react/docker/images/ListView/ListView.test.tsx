import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';

import { ListView } from './ListView';

vi.mock('./PullImageFormWidget', () => ({
  PullImageFormWidget: ({ isNodeVisible }: { isNodeVisible: boolean }) => (
    <div data-cy="pull-image-form-widget">
      PullImageFormWidget - isNodeVisible: {String(isNodeVisible)}
    </div>
  ),
}));
vi.mock('./ImagesDatatable/ImagesDatatable', () => ({
  ImagesDatatable: ({
    isHostColumnVisible,
  }: {
    isHostColumnVisible: boolean;
  }) => (
    <div data-cy="images-datatable">
      ImagesDatatable - isHostColumnVisible: {String(isHostColumnVisible)}
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

  describe('REQ-TAI-003 Docker Swarm is removed', () => {
    it('never shows the Swarm node selector or host column', async () => {
      renderComponent();

      expect(screen.getByTestId('pull-image-form-widget')).toHaveTextContent(
        'isNodeVisible: false'
      );
      expect(screen.getByTestId('images-datatable')).toHaveTextContent(
        'isHostColumnVisible: false'
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
