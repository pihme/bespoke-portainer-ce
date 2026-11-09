import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import selectEvent from '@/react/test-utils/react-select';

import { TemplateListSort } from './TemplateListSort';

const portal = { container: () => document.body };

describe('REQ-TPL-01 TemplateListSort', () => {
  it('selects a sort field and toggles descending order', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <TemplateListSort
        options={['Title', 'Categories', 'Description']}
        onChange={onChange}
        placeholder="Sort By"
        value={undefined}
      />
    );

    const sortButton = screen.getByRole('button');
    expect(sortButton).toBeDisabled();

    await selectEvent.select(screen.getByRole('combobox'), 'Title', {
      user,
      ...portal,
    });
    expect(onChange).toHaveBeenCalledWith({ id: 'Title', desc: false });

    rerender(
      <TemplateListSort
        options={['Title', 'Categories', 'Description']}
        onChange={onChange}
        placeholder="Sort By"
        value={{ id: 'Title', desc: false }}
      />
    );

    expect(screen.getByRole('button')).toBeEnabled();
    await user.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith({ id: 'Title', desc: true });
  });

  it('clears the sort field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TemplateListSort
        options={['Title', 'Description']}
        onChange={onChange}
        placeholder="Sort By"
        value={{ id: 'Title', desc: true }}
      />
    );

    await selectEvent.clearAll(screen.getByRole('combobox'), { user });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
