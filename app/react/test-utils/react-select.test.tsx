import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import selectEvent, {
  clearAll,
  clearFirst,
  create,
  openMenu,
  select,
} from './react-select';

function buildSelectDom({
  options = ['Alpha', 'Beta'],
  selected,
  creatable,
}: {
  options?: string[];
  selected?: string;
  creatable?: boolean;
} = {}) {
  return (
    <div data-cy="rs-root">
      <div>
        <div>
          <div>
            <div>
              <input aria-label="choice" defaultValue="" />
            </div>
          </div>
        </div>
      </div>
      {selected ? <div>{selected}</div> : null}
      <div role="listbox">
        {options.map((label) => (
          <div key={label}>{label}</div>
        ))}
        {creatable ? <div>Create "Gamma"</div> : null}
      </div>
      <svg aria-hidden="true" data-cy="clear" />
      <svg aria-hidden="true" data-cy="clear-all" />
      <svg aria-hidden="true" data-cy="arrow" />
    </div>
  );
}

describe('react-select test helpers', () => {
  it('openMenu clicks and types ArrowDown', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(user, 'click');
    const type = vi.spyOn(user, 'type');
    render(buildSelectDom());
    await openMenu(screen.getByLabelText('choice'), { user });
    expect(click).toHaveBeenCalled();
    expect(type).toHaveBeenCalledWith(
      screen.getByLabelText('choice'),
      '{ArrowDown}'
    );
  });

  it('select clicks a matching option in the derived container', async () => {
    const user = userEvent.setup();
    render(buildSelectDom());
    await select(screen.getByLabelText('choice'), 'Alpha', { user });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('select supports a container element and create flow', async () => {
    const user = userEvent.setup();
    render(buildSelectDom({ creatable: true }));
    const root = screen.getByTestId('rs-root');
    await select(screen.getByLabelText('choice'), 'Beta', {
      user,
      container: root,
    });
    await create(screen.getByLabelText('choice'), 'Gamma', {
      user,
      container: () => screen.getByTestId('rs-root'),
      waitForElement: false,
    });
  });

  it('clearFirst and clearAll click svg clear controls', async () => {
    const user = userEvent.setup();
    render(buildSelectDom({ selected: 'Alpha' }));
    await clearFirst(screen.getByLabelText('choice'), { user });
    await clearAll(screen.getByLabelText('choice'), { user });
  });

  it('setup binds helpers to a user instance', async () => {
    const user = userEvent.setup();
    const bound = selectEvent.setup(user);
    render(buildSelectDom());
    await bound.openMenu(screen.getByLabelText('choice'));
    await bound.select(screen.getByLabelText('choice'), 'Alpha', {
      container: screen.getByTestId('rs-root'),
    });
    expect(typeof bound.create).toBe('function');
    expect(typeof bound.clearFirst).toBe('function');
    expect(typeof bound.clearAll).toBe('function');
  });
});
