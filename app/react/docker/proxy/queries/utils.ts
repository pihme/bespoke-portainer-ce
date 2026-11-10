/**
 * Generates the `filters` query param entry for docker API list actions
 *
 * @param filters map[string][]string
 * @returns `{ filters: filters && JSON.stringify(filters) }`
 */
export function withFiltersQueryParam<T = unknown>(filters?: T) {
  return { filters: filters && JSON.stringify(filters) };
}

/**
 * The Docker API expects array query params as `param = value_1 & param = value_2`
 * axios default serializer generates `names[] = value_1 & names[] = value_2`
 * which are ignored by the Docker API
 * @param params
 * @returns the concatenated string of query params with Docker expected format
 */
export function formatArrayQueryParamsForDockerAPI(
  params: Record<string, unknown>
) {
  return Object.entries(params)
    .flatMap(([param, value]) =>
      (Array.isArray(value) ? value : [value]).map((v) => `${param}=${v}`)
    )
    .join('&');
}
