import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import fileMock from './fileMock';
import styleMock from './styleMock';
import SvgrMock from './svg';
import * as reactI18n from './react-i18next';
import i18n, { mockT } from './i18next';

describe('webpack asset mocks', () => {
  it('exports the file and style stubs', () => {
    expect(fileMock).toBe('test-file-stub');
    expect(styleMock).toEqual({});
  });

  it('renders the SVGR mock span', () => {
    render(createElement(SvgrMock, { 'data-cy': 'svg-mock' }));
    expect(screen.getByTestId('svg-mock').tagName).toBe('SPAN');
  });
});

describe('react-i18next mocks', () => {
  it('useTranslation returns mockT and changeLanguage', () => {
    const { t, i18n: i18nApi } = reactI18n.useTranslation();
    expect(t('hello')).toBe('hello');
    expect(i18nApi.changeLanguage('de')).toBeInstanceOf(Promise);
  });

  it('Trans renders children', () => {
    render(<reactI18n.Trans>plain</reactI18n.Trans>);
    expect(screen.getByText('plain')).toBeVisible();
  });
});

describe('i18next default export helpers', () => {
  it('exposes t, changeLanguage and use', () => {
    expect(i18n.t).toBe(mockT);
    expect(i18n.changeLanguage('fr')).toBeInstanceOf(Promise);
    expect(typeof i18n.use()).toBe('object');
  });
});
