import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';

import { withTestRouter } from '@/react/test-utils/withRouter';

import { NavTabs, Option } from './NavTabs';
import { NavContainer } from './NavContainer';

test('should show titles', async () => {
  const options = [
    { children: 'Content 1', id: 'option1', label: 'Option 1' },
    { children: 'Content 2', id: 'option2', label: 'Option 2' },
  ];
  const { findByText } = renderComponent(options);

  expect(await findByText(options[0].label as string)).toBeTruthy();
  expect(await findByText(options[1].label as string)).toBeTruthy();
});

test('should show selected id content', async () => {
  const options = [
    { children: 'Content 1', id: 'option1', label: 'Option 1' },
    { children: 'Content 2', id: 'option2', label: 'Option 2' },
  ];
  const selected = options[1];
  const { findByText } = renderComponent(options, selected.id);
  expect(await findByText(selected.children as string)).toBeTruthy();
});

test('should call onSelect when clicked with id', async () => {
  const user = userEvent.setup();
  const options = [
    { children: 'Content 1', id: 'option1', label: 'Option 1' },
    { children: 'Content 2', id: 'option2', label: 'Option 2' },
  ];
  const onSelect = vi.fn();
  const { findByText } = renderComponent(options, options[1].id, onSelect);
  await user.click(await findByText(options[0].label as string));
  expect(onSelect).toHaveBeenCalledWith(options[0].id);
});

test('ignores clicks while disabled and hides hidden options', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const options: Option[] = [
    { id: 'a', label: 'A', children: 'ca' },
    { id: 'b', label: 'B', children: 'cb', hidden: true },
  ];
  renderComponent(options, 'a', onSelect, true);
  expect(screen.queryByText('B')).not.toBeInTheDocument();
  await user.click(screen.getByText('A'));
  expect(onSelect).not.toHaveBeenCalled();
});

test('supports pills and justified layout without children', () => {
  renderComponent(
    [{ id: 'only', label: 'Only' }],
    'only',
    undefined,
    false,
    'pills',
    true
  );
  expect(screen.getByText('Only')).toBeVisible();
  expect(document.querySelector('.nav-pills')).toBeTruthy();
  expect(document.querySelector('.nav-justified')).toBeTruthy();
});

describe('NavContainer', () => {
  it('renders children', () => {
    render(
      <NavContainer>
        <span>inside</span>
      </NavContainer>
    );
    expect(screen.getByText('inside')).toBeVisible();
  });
});

function renderComponent(
  options: Option[] = [],
  selectedId?: string | number,
  onSelect?: (id: string | number) => void,
  disabled = false,
  type: 'tabs' | 'pills' = 'tabs',
  justified = false
) {
  const Wrapped = withTestRouter(NavTabs);
  return render(
    <Wrapped
      options={options}
      selectedId={selectedId}
      onSelect={onSelect}
      disabled={disabled}
      type={type}
      justified={justified}
    />
  );
}
