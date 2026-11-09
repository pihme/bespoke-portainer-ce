import { render, screen } from '@testing-library/react';

import { FormSectionTitle } from './FormSectionTitle';

test('should display a FormSectionTitle with children', async () => {
  const children = 'test form title';
  const { findByText } = render(
    <FormSectionTitle>{children}</FormSectionTitle>
  );

  const heading = await findByText(children);
  expect(heading).toBeTruthy();
});

test('renders a label when htmlFor is set and applies title sizes', () => {
  const { rerender } = render(
    <FormSectionTitle htmlFor="field-a" titleSize="sm" id="title-sm" className="extra">
      Label title
    </FormSectionTitle>
  );
  const label = screen.getByText('Label title');
  expect(label.tagName).toBe('LABEL');
  expect(label).toHaveAttribute('for', 'field-a');
  expect(label.className).toContain('text-sm');
  expect(label.className).toContain('extra');
  expect(label).toHaveAttribute('id', 'title-sm');

  rerender(
    <FormSectionTitle htmlFor="field-b" titleSize="lg">
      Large title
    </FormSectionTitle>
  );
  expect(screen.getByText('Large title').className).toContain('text-lg');
});
