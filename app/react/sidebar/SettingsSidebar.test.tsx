import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { UserViewModel } from '@/portainer/models/user';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import * as featureFlags from '@/react/portainer/feature-flags/feature-flags.service';
import { usePublicSettings } from '@/react/portainer/settings/queries';
import { PublicSettingsResponse } from '@/react/portainer/settings/types';

import { TestSidebarProvider } from './useSidebarState';
import { SettingsSidebar } from './SettingsSidebar';

vi.mock('@/react/portainer/settings/queries', () => ({
  usePublicSettings: vi.fn(),
}));

describe('SettingsSidebar', () => {
  beforeEach(() => {
    vi.spyOn(featureFlags, 'isBE', 'get').mockReturnValue(false);
    // Default mock for usePublicSettings - returns data based on selector
    vi.mocked(usePublicSettings).mockImplementation(((options?: {
      select?: (settings: PublicSettingsResponse) => PublicSettingsResponse;
    }) => {
      const settings: PublicSettingsResponse = {
        EnableEdgeComputeFeatures: false,
      } as unknown as PublicSettingsResponse;
      return {
        data: options?.select ? options.select(settings) : settings,
        isLoading: false,
        isError: false,
      };
    }) as typeof usePublicSettings);
    window.ddExtension = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Pure Admin User', () => {
    it('should render all admin sections for pure admin', () => {
      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(screen.getByText('Administration')).toBeInTheDocument();
      expect(
        screen.getByTestId('portainerSidebar-environments-area')
      ).toBeInTheDocument();
      // REQ-TAI-005: no Registries entry
      expect(
        screen.queryByTestId('portainerSidebar-registries')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('portainerSidebar-activityLogs')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('portainerSidebar-notifications')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('portainerSidebar-settings')
      ).toBeInTheDocument();
    });

    it('REQ-TAI-001 renders no user-related section', () => {
      renderComponent({ isPureAdmin: true, isAdmin: true });

      for (const id of [
        'portainerSidebar-userRelated',
        'portainerSidebar-users',
        'portainerSidebar-teams',
        'portainerSidebar-roles',
      ]) {
        expect(screen.queryByTestId(id)).not.toBeInTheDocument();
      }
    });

    it('should render environment-related submenu items', () => {
      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(
        screen.getByTestId('portainerSidebar-environments')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('portainerSidebar-environmentGroups')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('portainerSidebar-environmentTags')
      ).toBeInTheDocument();
    });

    it('should render logs submenu items', () => {
      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(
        screen.getByTestId('portainerSidebar-activityLogs')
      ).toBeInTheDocument();
      // REQ-TAI-001: no authentication logs
      expect(
        screen.queryByTestId('portainerSidebar-authLogs')
      ).not.toBeInTheDocument();
    });

    it('should render settings submenu items', () => {
      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(
        screen.getByTestId('portainerSidebar-generalSettings')
      ).toBeInTheDocument();
      // REQ-TAI-001: no authentication settings
      expect(
        screen.queryByTestId('portainerSidebar-authentication')
      ).not.toBeInTheDocument();
      // REQ-TAI-004: no Edge Compute settings
      expect(
        screen.queryByTestId('portainerSidebar-edgeCompute')
      ).not.toBeInTheDocument();
    });

    it('should render Get Help link with correct CE URL', () => {
      renderComponent({ isPureAdmin: true, isAdmin: true });

      const helpLink = screen.getByRole('link', { name: /Get Help/i });
      expect(helpLink).toBeInTheDocument();
      expect(helpLink).toHaveAttribute(
        'href',
        'https://www.portainer.io/resources/get-support'
      );
      expect(helpLink).toHaveAttribute('target', '_blank');
      expect(helpLink).toHaveAttribute('rel', 'noreferrer');
    });

    it('should not render Licenses sidebar item in CE', () => {
      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(
        screen.queryByTestId('portainerSidebar-licenses')
      ).not.toBeInTheDocument();
    });

    it('should not render Shared Credentials in CE', () => {
      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(
        screen.queryByTestId('portainerSidebar-cloud')
      ).not.toBeInTheDocument();
    });
  });

  describe('Regular Admin User (not Pure Admin)', () => {
    it('should not render admin-only sections', () => {
      renderComponent({ isPureAdmin: false, isAdmin: true });

      expect(
        screen.queryByTestId('portainerSidebar-userRelated')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('portainerSidebar-environments-area')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('portainerSidebar-registries')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('portainerSidebar-activityLogs')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('portainerSidebar-settings')
      ).not.toBeInTheDocument();
    });

    it('should render notifications for regular admin', () => {
      renderComponent({ isPureAdmin: false, isAdmin: true });

      expect(
        screen.getByTestId('portainerSidebar-notifications')
      ).toBeInTheDocument();
    });
  });

  describe('DD Extension Environment', () => {
    it('should still render other admin sections when ddExtension is enabled', () => {
      window.ddExtension = true;

      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(
        screen.getByTestId('portainerSidebar-environments-area')
      ).toBeInTheDocument();
      // REQ-TAI-005: no Registries entry
      expect(
        screen.queryByTestId('portainerSidebar-registries')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('portainerSidebar-settings')
      ).toBeInTheDocument();
    });
  });

  describe('REQ-TAI-004 no Edge Update & Rollback', () => {
    it('should not render Update & Rollback when edge compute is disabled in CE', () => {
      vi.mocked(usePublicSettings).mockImplementation(((options?: {
        select?: (settings: PublicSettingsResponse) => PublicSettingsResponse;
      }) => {
        const settings: PublicSettingsResponse = {
            EnableEdgeComputeFeatures: false,
        } as unknown as PublicSettingsResponse;
        return {
          data: options?.select ? options.select(settings) : settings,
          isLoading: false,
          isError: false,
        };
      }) as typeof usePublicSettings);

      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(
        screen.queryByTestId('portainerSidebar-updateSchedules')
      ).not.toBeInTheDocument();
    });

    it('should not render Update & Rollback in CE even when edge compute is enabled', () => {
      vi.mocked(usePublicSettings).mockImplementation(((options?: {
        select?: (settings: PublicSettingsResponse) => PublicSettingsResponse;
      }) => {
        const settings: PublicSettingsResponse = {
            EnableEdgeComputeFeatures: true,
        } as unknown as PublicSettingsResponse;
        return {
          data: options?.select ? options.select(settings) : settings,
          isLoading: false,
          isError: false,
        };
      }) as typeof usePublicSettings);

      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(
        screen.queryByTestId('portainerSidebar-updateSchedules')
      ).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should handle loading state for public settings', () => {
      vi.mocked(usePublicSettings).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as ReturnType<typeof usePublicSettings>);

      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(screen.getByText('Administration')).toBeInTheDocument();
    });

    it('should handle error state for public settings', () => {
      vi.mocked(usePublicSettings).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as ReturnType<typeof usePublicSettings>);

      renderComponent({ isPureAdmin: true, isAdmin: true });

      expect(screen.getByText('Administration')).toBeInTheDocument();
    });
  });
});

function renderComponent({
  isPureAdmin,
  isAdmin,
}: {
  isPureAdmin: boolean;
  isAdmin: boolean;
}) {
  const user = new UserViewModel({ Username: 'user' });

  const Wrapped = withUserProvider(withTestRouter(SettingsSidebar), user);

  return render(
    <TestSidebarProvider>
      <Wrapped
        isPureAdmin={isPureAdmin}
        isAdmin={isAdmin}
      />
    </TestSidebarProvider>
  );
}
