import { render, screen } from '@testing-library/react';

import { DetailField } from './DetailField';

describe('REQ-GIT-01 DetailField', () => {
  it('TestREQ_GIT_01_renders_label_and_children', () => {
    render(<DetailField label="Name">demo-source</DetailField>);

    expect(screen.getByText('Name')).toBeVisible();
    expect(screen.getByText('demo-source')).toBeVisible();
  });
});
