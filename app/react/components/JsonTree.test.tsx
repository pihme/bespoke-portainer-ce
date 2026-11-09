import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JsonTree } from './JsonTree';

describe('JsonTree', () => {
  it('renders JSON with default styles', () => {
    render(<JsonTree data={{ name: 'nginx', replicas: 2 }} />);
    expect(screen.getByText(/name/i)).toBeTruthy();
  });

  it('passes through a custom style object', () => {
    render(
      <JsonTree
        data={{ ok: true }}
        style={{
          container: 'custom-tree',
          label: 'custom-label',
          booleanValue: '',
          nullValue: '',
          numberValue: '',
          stringValue: '',
          otherValue: '',
          undefinedValue: '',
          punctuation: '',
          collapseIcon: '',
          expandIcon: '',
          collapsedContent: '',
        }}
      />
    );
    expect(document.querySelector('.custom-tree')).toBeTruthy();
  });
});
