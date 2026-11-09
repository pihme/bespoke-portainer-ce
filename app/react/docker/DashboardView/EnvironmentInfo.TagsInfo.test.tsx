import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { DetailsTable } from '@@/DetailsTable';

import { TagsInfo } from './EnvironmentInfo.TagsInfo';

vi.mock('@/portainer/tags/queries', () => ({
  useTags: vi.fn(),
}));

import { useTags } from '@/portainer/tags/queries';

function renderTags(ids: number[]) {
  return render(
    <DetailsTable dataCy="tags-info">
      <TagsInfo ids={ids} />
    </DetailsTable>
  );
}

describe('REQ-ENV-14 TagsInfo', () => {
  it('renders nothing while tags are loading', () => {
    vi.mocked(useTags).mockReturnValue({ data: undefined } as ReturnType<
      typeof useTags
    >);

    const { container } = renderTags([1]);
    expect(container.querySelector('tr')).toBeNull();
  });

  it('shows a dash when the environment has no tag ids', () => {
    vi.mocked(useTags).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useTags
    >);

    renderTags([]);

    expect(screen.getByLabelText('Tags')).toBeVisible();
    expect(screen.getByText('-')).toBeVisible();
  });

  it('shows matching tag names for the given ids', () => {
    vi.mocked(useTags).mockReturnValue({
      data: [
        { ID: 1, Name: 'prod', Endpoints: {} },
        { ID: 2, Name: 'staging', Endpoints: {} },
        { ID: 3, Name: 'unused', Endpoints: {} },
      ],
    } as unknown as ReturnType<typeof useTags>);

    renderTags([1, 2]);

    const row = screen.getByLabelText('Tags');
    expect(row).toHaveTextContent('prod');
    expect(row).toHaveTextContent('staging');
    expect(row).not.toHaveTextContent('unused');
  });
});
