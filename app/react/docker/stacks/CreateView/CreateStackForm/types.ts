
import { EnvVarValues } from '@@/form-components/EnvironmentVariablesFieldset';

import { EditorFormValues } from './EditorSection/types';
import { GitFormValues } from './GitSection/types';
import { TemplateFormValues } from './TemplateSection/types';
import { UploadFormValues } from './UploadSection/types';

export type BuildMethod = 'editor' | 'upload' | 'repository' | 'template';

export interface BaseFormValues {
  method: BuildMethod;
  name: string;
  env: EnvVarValues;
  enableWebhook: boolean;
  registries: Array<number>;
}

export interface FormValues extends BaseFormValues {
  editor: EditorFormValues;
  upload: UploadFormValues;
  git: GitFormValues;
  template: TemplateFormValues;
}
