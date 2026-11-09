import { render } from '@testing-library/react';
import { Info } from 'lucide-react';

import { TextTip } from './TextTip';

test('should display a TextTip with children', async () => {
  const children = 'test text tip';
  const { findByText } = render(<TextTip>{children}</TextTip>);

  const heading = await findByText(children);
  expect(heading).toBeTruthy();
});

test('maps color prop to icon mode and supports block layout', () => {
  const { rerender, container, getByText } = render(
    <TextTip color="blue">blue tip</TextTip>
  );
  expect(getByText('blue tip')).toBeTruthy();
  expect(container.querySelector('[role="status"]')?.className).toContain(
    'inline-flex'
  );

  rerender(<TextTip color="red">red tip</TextTip>);
  expect(getByText('red tip')).toBeTruthy();

  rerender(<TextTip color="green">green tip</TextTip>);
  expect(getByText('green tip')).toBeTruthy();

  rerender(
    <TextTip color="orange" inline={false} className="extra" childrenWrapperClassName="wrap">
      block tip
    </TextTip>
  );
  const status = container.querySelector('[role="status"]');
  expect(status?.className).toContain('flex');
  expect(status?.className).not.toContain('inline-flex');
  expect(getByText('block tip').className).toContain('wrap');
});

test('accepts a custom icon', () => {
  const { container } = render(
    <TextTip icon={Info}>custom icon tip</TextTip>
  );
  expect(container.querySelector('[role="status"]')).toBeTruthy();
});
