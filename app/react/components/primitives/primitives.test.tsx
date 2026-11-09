import { render, screen } from '@testing-library/react';
import { Box } from 'lucide-react';
import userEvent from '@testing-library/user-event';

import { Card } from './Card';
import { StatusDot } from './StatusDot';
import { Tabs } from './Tabs/Tabs';

describe('primitives (backwards compatibility)', () => {
  it('renders Card container header and body', () => {
    render(
      <Card.Container variant="filled" shadow>
        <Card.Header title="Title" subtitle="Sub" icon={Box} actions={<button type="button">Go</button>} />
        <Card.Body>Body</Card.Body>
      </Card.Container>
    );
    expect(screen.getByText('Title')).toBeVisible();
    expect(screen.getByText('Sub')).toBeVisible();
    expect(screen.getByText('Body')).toBeVisible();
    expect(screen.getByText('Go')).toBeVisible();
  });

  it('renders StatusDot variants', () => {
    const { container } = render(
      <>
        <StatusDot color="success" size="sm" pulse />
        <StatusDot color="danger" />
      </>
    );
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(2);
  });

  it('renders contained and pill tab bars', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Tabs.Container variant="contained" aria-label="modes">
          <Tabs.Item isActive onClick={onClick}>List</Tabs.Item>
          <Tabs.Item>Grid</Tabs.Item>
        </Tabs.Container>
        <Tabs.Container variant="pill" size="sm" aria-label="pills">
          <Tabs.Item isActive>One</Tabs.Item>
          <Tabs.Item disabled>Two</Tabs.Item>
        </Tabs.Container>
      </>
    );
    expect(screen.getByLabelText('modes')).toBeVisible();
    await user.click(screen.getByText('List'));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByText('Two')).toBeDisabled();
  });
});
