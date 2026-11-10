import { render, screen } from '@testing-library/react';

import { createMockUser } from '@/react-tools/test-mocks';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';

import { TestSidebarProvider } from './useSidebarState';
import { AppDeliverySidebar } from './AppDeliverySidebar';

describe('AppDeliverySidebar', () => {
  it('REQ-TAI-011 renders the sources link and no workflows link', () => {
    const Wrapped = withUserProvider(
      withTestRouter(AppDeliverySidebar),
      createMockUser()
    );

    render(
      <TestSidebarProvider>
        <Wrapped />
      </TestSidebarProvider>
    );

    expect(screen.getByText('App Delivery')).toBeInTheDocument();
    expect(
      screen.queryByTestId('portainerSidebar-workflows')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-sources')).toBeInTheDocument();
  });
});
