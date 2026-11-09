import { VariablesFieldValue } from '@/react/portainer/custom-templates/components/CustomTemplatesVariablesField';

export interface FormValues {
  name: string;
  variables: VariablesFieldValue;
  fileContent: string;
}
