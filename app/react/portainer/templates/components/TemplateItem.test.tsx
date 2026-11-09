import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { withTestRouter } from '@/react/test-utils/withRouter';

import { Platform } from '../types';

import { TemplateItem } from './TemplateItem';

const baseTemplate = {
  Id: 1,
  Title: 'Nginx',
  Description: 'Web server',
  Categories: ['web', 'proxy'],
};

describe('TemplateItem', () => {
  it('renders title description categories and invokes onSelect', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <TemplateItem
        template={baseTemplate}
        typeLabel="container"
        onSelect={onSelect}
        renderActions={<button type="button">Edit</button>}
        isSelected={false}
      />
    );

    expect(screen.getByText('Nginx')).toBeVisible();
    expect(screen.getByText('Web server')).toBeVisible();
    expect(screen.getByText('web, proxy')).toBeVisible();
    expect(screen.getByText('container')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();

    await user.click(screen.getByLabelText('Nginx'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('renders linux-only and windows-only platform icons', () => {
    const { rerender } = render(
      <TemplateItem
        template={{ ...baseTemplate, Platform: Platform.LINUX }}
        typeLabel="stack"
        onSelect={() => {}}
        renderActions={null}
        isSelected
      />
    );
    expect(screen.getByText('Nginx')).toBeVisible();

    rerender(
      <TemplateItem
        template={{ ...baseTemplate, Platform: Platform.WINDOWS, Categories: [] }}
        typeLabel="stack"
        onSelect={() => {}}
        renderActions={null}
        isSelected={false}
      />
    );
    expect(screen.getByText('Nginx')).toBeVisible();
    expect(screen.queryByText('web, proxy')).toBeNull();
  });

  it('supports linkParams via router Link', () => {
    const Wrapped = withTestRouter(TemplateItem);
    render(
      <Wrapped
        template={baseTemplate}
        typeLabel="stack"
        onSelect={() => {}}
        renderActions={null}
        isSelected={false}
        linkParams={{ to: 'portainer.templates', params: { id: 1 } }}
      />
    );
    expect(screen.getByLabelText('Nginx')).toBeVisible();
  });
});
