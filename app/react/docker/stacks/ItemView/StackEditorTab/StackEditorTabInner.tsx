import { Form, useFormikContext } from 'formik';
import { JSONSchema7 } from 'json-schema';
import { useCallback } from 'react';

import { Stack, StackType } from '@/react/common/stacks/types';
import { PruneField } from '@/react/common/stacks/PruneField';
import { EnvironmentType } from '@/react/portainer/environments/types';
import { Authorized, useAuthorizations } from '@/react/hooks/useUser';

import { CodeEditor } from '@@/CodeEditor';
import { StackEnvironmentVariablesPanel } from '@@/form-components/EnvironmentVariablesFieldset';
import { FormActions } from '@@/form-components/FormActions';
import { usePreventExit } from '@@/WebEditorForm';
import { FormError } from '@@/form-components/FormError';


import { StackEditorFormValues } from './StackEditorTab.types';
import { useVersionedStackFile } from './useVersionedStackFile';

interface StackEditorTabInnerProps {
  stackType: StackType | undefined;
  composeSyntaxMaxVersion: number;
  /** Inert since TAI-012 removed the BE-only stack webhook teaser. */
  envType: EnvironmentType;
  schema: JSONSchema7;
  isOrphaned: boolean;
  versions?: Array<number>;
  stackId: Stack['Id'];
  isSaved: boolean;
  isSubmitting: boolean;
  /** Inert since TAI-012 removed the BE-only stack webhook teaser. */
  webhookId: string;
}

export function StackEditorTabInner({
  stackType,
  composeSyntaxMaxVersion,
  schema,
  isOrphaned,
  versions,
  stackId,
  isSaved,
  isSubmitting,
}: StackEditorTabInnerProps) {
  const { authorized: isAuthorizedToUpdate } = useAuthorizations(
    'PortainerStackUpdate'
  );

  const { values, errors, setFieldValue, isValid, initialValues } =
    useFormikContext<StackEditorFormValues>();

  usePreventExit(
    initialValues.stackFileContent,
    values.stackFileContent,
    !isSubmitting && !isSaved
  );

  const handleLoadFile = useCallback(
    (content: string) => {
      setFieldValue('stackFileContent', content);
    },
    [setFieldValue]
  );

  useVersionedStackFile({
    stackId,
    version: values.rollbackTo,
    onLoad: handleLoadFile,
  });

  const isDeployDisabled = isOrphaned;

  return (
    <Form className="form-horizontal">
      {/* Docker Compose Info Section */}
      <div className="form-group mb-0 space-y-2">
        {stackType === StackType.DockerCompose &&
          composeSyntaxMaxVersion === 2 && (
            <span className="col-sm-12 text-muted small">
              This stack will be deployed using the equivalent of{' '}
              <code>docker compose</code>. Only Compose file format version{' '}
              <b>2</b> is supported at the moment.
            </span>
          )}
        {stackType === StackType.DockerCompose &&
          composeSyntaxMaxVersion > 2 && (
            <span className="col-sm-12 text-muted small">
              This stack will be deployed using <code>docker compose</code>.
            </span>
          )}
        <span className="col-sm-12 text-muted small">
          You can get more information about Compose file format in the{' '}
          <a
            href="https://docs.docker.com/reference/compose-file/"
            target="_blank"
            rel="noreferrer"
          >
            official documentation
          </a>
          .
        </span>
        <div className="col-sm-12">
          {errors.stackFileContent && (
            <FormError>{errors.stackFileContent}</FormError>
          )}
        </div>
      </div>

      <div className="form-group">
        <div className="col-sm-12">
          <CodeEditor
            id="stack-editor"
            textTip="Define or paste the content of your docker compose file here"
            type="yaml"
            onChange={(value) => setFieldValue('stackFileContent', value)}
            value={values.stackFileContent}
            readonly={isOrphaned || !isAuthorizedToUpdate}
            schema={schema}
            data-cy="stack-editor"
            onVersionChange={handleVersionChange}
            versions={versions}
          />
        </div>
      </div>

      <StackEnvironmentVariablesPanel
        values={values.environmentVariables}
        onChange={(envVars) => setFieldValue('environmentVariables', envVars)}
        errors={errors.environmentVariables}
        showHelpMessage
        isFoldable
      />

      <Authorized authorizations="PortainerStackUpdate">
        <PruneField
          stackType={stackType}
          checked={values.prune}
          onChange={(checked) => setFieldValue('prune', checked)}
        />
      </Authorized>

      <Authorized authorizations="PortainerStackUpdate">
        <FormActions
          isValid={isValid && !isDeployDisabled}
          isLoading={isSubmitting}
          loadingText="Deployment in progress..."
          submitLabel="Update the stack"
          data-cy="stack-deploy-button"
        />
      </Authorized>
    </Form>
  );

  async function handleVersionChange(newVersion: number) {
    if (versions && versions.length > 1) {
      setFieldValue(
        'rollbackTo',
        newVersion < versions[0] ? newVersion : versions[0]
      );
    }
  }
}
