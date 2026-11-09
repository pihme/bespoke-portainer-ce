import { toGitFormModel } from '@/react/portainer/gitops/types';

import { CustomTemplate, getTemplateSourceId } from '../types';

import { FormValues } from './types';

export function useInitialValues({
  template,
  templateFile,
}: {
  template: CustomTemplate;
  templateFile: string | undefined;
}): FormValues | undefined {
  return {
    Title: template.Title,
    FileContent: templateFile || '',
    Type: template.Type,
    Platform: template.Platform,
    Description: template.Description,
    Note: template.Note,
    Logo: template.Logo,
    Variables: template.Variables,
    Git: template.GitConfig
      ? toGitFormModel(getTemplateSourceId(template), template.GitConfig)
      : undefined,
    EdgeSettings: template.EdgeSettings,
  };
}
