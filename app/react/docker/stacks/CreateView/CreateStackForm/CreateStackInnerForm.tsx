import { Form, useFormikContext } from 'formik';

import { NameField } from '@/react/docker/stacks/common/NameField';
import { useDockerComposeSchema } from '@/react/hooks/useDockerComposeSchema/useDockerComposeSchema';
import { useCurrentEnvironment } from '@/react/hooks/useCurrentEnvironment';

import { BoxSelector } from '@@/BoxSelector';
import { LoadingButton } from '@@/buttons';
import { FormSection } from '@@/form-components/FormSection';
import { StackEnvironmentVariablesPanel } from '@@/form-components/EnvironmentVariablesFieldset';
import {
  editor,
  upload,
  git,
  customTemplate,
} from '@@/BoxSelector/common-options/build-methods';


import { EditorSection } from './EditorSection/EditorSection';
import { UploadSection } from './UploadSection/UploadSection';
import { GitSection } from './GitSection/GitSection';
import { TemplateSection } from './TemplateSection/TemplateSection';
import { DeploymentInfo } from './DeploymentInfo';
import { FormValues } from './types';

const buildMethods = [editor, upload, git, customTemplate];

export function CreateStackInnerForm({
  isDeploying,
  isSaved,
  webhookId,
}: {
  isDeploying: boolean;
  isSaved: boolean;
  webhookId: string;
}) {
  const environmentQuery = useCurrentEnvironment();
  const schemaQuery = useDockerComposeSchema();
  const formikContext = useFormikContext<FormValues>();
  const { errors, values, setFieldValue, isValid } = formikContext;

  if (!environmentQuery.data) {
    return null;
  }

  const environment = environmentQuery.data;

  const dockerComposeSchema = schemaQuery.data;
  const composeSyntaxMaxVersion = environment?.ComposeSyntaxMaxVersion
    ? parseInt(environment.ComposeSyntaxMaxVersion, 10)
    : undefined;

  return (
    <Form className="form-horizontal">
      <NameField
        value={values.name}
        onChange={(name) => setFieldValue('name', name)}
        placeholder="e.g. mystack"
        errors={errors.name}
      />

      <DeploymentInfo composeSyntaxMaxVersion={composeSyntaxMaxVersion} />

      <FormSection title="Build method">
        <BoxSelector
          radioName="build-method"
          value={values.method}
          onChange={(method) => setFieldValue('method', method)}
          options={buildMethods}
          slim
        />
      </FormSection>

      {values.method === 'upload' && <UploadSection />}

      {values.method === 'repository' && (
        <GitSection isDockerStandalone webhookId={webhookId} />
      )}

      {values.method === 'template' && (
        <TemplateSection
          schema={dockerComposeSchema}
          isSaved={isSaved}
        />
      )}

      {values.method === 'editor' && (
        <EditorSection
          schema={dockerComposeSchema}
          isSaved={isSaved}
        />
      )}

      <StackEnvironmentVariablesPanel
        values={values.env}
        onChange={(env) => setFieldValue('env', env)}
        errors={errors.env}
      />

      <FormSection title="Actions">
        <LoadingButton
          loadingText="Deployment in progress..."
          isLoading={isDeploying}
          disabled={!isValid}
          className="!ml-0"
          data-cy="create-stack-submit-btn"
        >
          Deploy the stack
        </LoadingButton>
      </FormSection>
    </Form>
  );
}
