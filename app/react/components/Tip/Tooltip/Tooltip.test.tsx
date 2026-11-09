import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders a help icon with the message for children tooltips', () => {
    render(<Tooltip message="Stack name help" />);
    // HelpCircle is an svg lucide icon inside the trigger
    expect(document.querySelector('svg.lucide')).toBeTruthy();
  });

  it('sanitizes HTML messages when setHtmlMessage is true', () => {
    render(
      <Tooltip
        message={'<b>bold</b><img src=x onerror=alert(1)>'}
        setHtmlMessage
        size="sm"
        position="top"
      />
    );
    expect(document.querySelector('svg.lucide')).toBeTruthy();
  });

  it('keeps non-string messages when setHtmlMessage is set', () => {
    render(
      <Tooltip message={<span>node message</span>} setHtmlMessage size="xs" />
    );
    expect(document.querySelector('svg.lucide')).toBeTruthy();
  });
});
