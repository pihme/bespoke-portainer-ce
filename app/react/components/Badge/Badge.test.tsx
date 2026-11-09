import { render } from '@testing-library/react';
import { AlertTriangle } from 'lucide-react';

import { Badge } from './Badge';
import { ExternalBadge } from './ExternalBadge';
import { SystemBadge } from './SystemBadge';
import { UnusedBadge } from './UnusedBadge';

test('should render a Badge component with default type', () => {
  const { getByText } = render(<Badge>Default Badge</Badge>);
  const badgeElement = getByText('Default Badge');
  expect(badgeElement).toBeInTheDocument();
  expect(badgeElement).toHaveClass('text-blue-9 bg-blue-2');
});

test('should render a Badge component with custom type', () => {
  const { getByText } = render(<Badge type="success">Success Badge</Badge>);
  const badgeElement = getByText('Success Badge');
  expect(badgeElement).toBeInTheDocument();
  expect(badgeElement).toHaveClass('text-success-9 bg-success-2');
});

test('should render a Badge component with custom className', () => {
  const { getByText } = render(
    <Badge className="custom-class">Custom Badge</Badge>
  );
  const badgeElement = getByText('Custom Badge');
  expect(badgeElement).toBeInTheDocument();
  expect(badgeElement).toHaveClass('custom-class');
});

test('renders specialized badges and optional icon', () => {
  const { getByText, rerender } = render(<UnusedBadge />);
  expect(getByText('Unused')).toBeInTheDocument();
  rerender(<SystemBadge className="sys" />);
  expect(getByText('System')).toHaveClass('sys');
  rerender(<ExternalBadge className="ext" />);
  expect(getByText('External')).toHaveClass('ext');
  rerender(
    <Badge type="danger" icon={AlertTriangle} data-cy="badge-icon">
      Warn
    </Badge>
  );
  expect(getByText('Warn')).toBeInTheDocument();
});
