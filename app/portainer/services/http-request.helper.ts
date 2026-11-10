import { AxiosRequestConfig } from 'axios';

export const CACHE_DURATION = 5 * 60 * 1000; // 5m in ms
// event emitted when cache need to be refreshed
// used to sync $http + axios cache clear
export const CACHE_REFRESH_EVENT = '__cache__refresh__event__';

// utility function to dispatch catch refresh event
export function dispatchCacheRefreshEvent() {
  dispatchEvent(new CustomEvent(CACHE_REFRESH_EVENT, {}));
}

// perform checks on config.method and config.url
// to dispatch event in only specific scenarios
export function dispatchCacheRefreshEventIfNeeded(req: AxiosRequestConfig) {
  if (
    req.method &&
    ['post', 'patch', 'put', 'delete'].includes(req.method.toLowerCase()) &&
    // don't clear cache when we try to check for namespaces accesses
    // otherwise we will clear it on every page
    req.url &&
    !req.url.includes('selfsubjectaccessreviews') &&
    req.url.includes('kubernetes')
  ) {
    dispatchCacheRefreshEvent();
  }
}

interface Headers {
  registryAuthentication?: string;
}

// The Portainer Agent and its per-node target header are removed (TAI-007).
const headers: Headers = {};

export function registryAuthenticationHeader() {
  return headers.registryAuthentication;
}

export function setRegistryAuthenticationHeader(headerValue: string) {
  headers.registryAuthentication = headerValue;
}

export function resetAgentHeaders() {
  delete headers.registryAuthentication;
}

/* @ngInject */
export function HttpRequestHelperAngular() {
  return {
    registryAuthenticationHeader,
    setRegistryAuthenticationHeader,
    resetAgentHeaders,
  };
}
