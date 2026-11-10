import { useQuery } from '@tanstack/react-query';

import axios, { parseAxiosError } from '@/portainer/services/axios/axios';
import { EnvironmentId } from '@/react/portainer/environments/types';

import { AppTemplate } from '../types';
import { TemplateViewModel } from '../view-model';

import { buildUrl } from './build-url';

export type AppTemplatesResponse = {
  version: string;
  templates: Array<AppTemplate>;
};

export function useAppTemplates<T = Array<TemplateViewModel>>({
  select,
  enabled = true,
}: {
  /** kept for callers; registries per environment are gone (TAI-005) */
  environmentId?: EnvironmentId;
  select?: (templates: Array<TemplateViewModel>) => T;
  enabled?: boolean;
} = {}) {
  return useQuery(['templates'], () => getTemplates(), {
    enabled,
    select,
  });
}

export function useAppTemplate(
  id: AppTemplate['id'] | undefined,
  { enabled }: { enabled?: boolean } = {}
) {
  return useAppTemplates({
    enabled: !!id && enabled,
    select: (templates) => templates.find((t) => t.Id === id),
  });
}

/**
 * TAI-005: registries are gone, so templates are no longer matched against
 * registry objects; the image name carries any registry host.
 */
async function getTemplates() {
  const { templates, version } = await getAppTemplates();
  return templates.map((item) => new TemplateViewModel(item, version));
}

export async function getAppTemplates() {
  try {
    const { data } = await axios.get<AppTemplatesResponse>(buildUrl());
    return data;
  } catch (err) {
    throw parseAxiosError(err);
  }
}
