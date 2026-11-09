import { describe, expect, it } from 'vitest';

import { InformationPanelAngular } from './InformationPanelAngular';
import { InformationPanelAngular as reexported } from './index';

describe('InformationPanelAngular', () => {
  it('exports the angular component definition used by portainer.app', () => {
    expect(InformationPanelAngular.templateUrl).toBe(
      './InformationPanelAngular.html'
    );
    expect(InformationPanelAngular.bindings).toEqual({
      titleText: '@',
      dismissAction: '&?',
    });
    expect(InformationPanelAngular.transclude).toBe(true);
    expect(reexported).toBe(InformationPanelAngular);
  });
});
