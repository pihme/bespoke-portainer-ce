import { render, screen } from '@testing-library/react';

import { TemplateNote } from './TemplateNote';

describe('TemplateNote', () => {
  it('returns null when note is missing', () => {
    const { container } = render(<TemplateNote />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders sanitized note html under Information', () => {
    render(<TemplateNote note="<b>hello</b><script>alert(1)</script>" />);
    expect(screen.getByText('Information')).toBeVisible();
    expect(screen.getByText('hello')).toBeVisible();
    expect(document.querySelector('script')).toBeNull();
  });
});
