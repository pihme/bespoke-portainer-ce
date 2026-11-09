import { render } from '@testing-library/react';
import { Rocket } from 'lucide-react';

import { LogoIcon } from './LogoIcon';

describe('LogoIcon', () => {
  it('renders the icon inside a fixed-size container', () => {
    const { container } = render(
      <LogoIcon icon={Rocket} iconClass="text-blue-8" />
    );
    expect(container.querySelector('.text-7xl')).toBeTruthy();
  });
});
