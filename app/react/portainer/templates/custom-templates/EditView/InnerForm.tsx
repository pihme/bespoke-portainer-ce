import { Form, useFormikContext } from 'formik';
import { RefreshCw } from 'lucide-react';

import { CommonFields } from '@/react/portainer/custom-templates/components/CommonFields';
import { CustomTemplatesVariablesDefinitionField } from '@/react/portainer/custom-templates/components/CustomTemplatesVariablesDefinitionField';
import { PlatformField } from '@/react/portainer/custom-templates/components/PlatformSelector';
import { GitForm } from '@/react/portainer/gitops/GitForm';
import { isTemplateVariablesEnabled } from '@/react/portainer/custom-templates/components/utils';
import { TemplateTypeSelector } from '@/react/portainer/custom-templates/components/TemplateTypeSelector';
import { StackType } from '@/react/common/stacks/types';
import { textByType } from '@/react/common/stacks/common/form-texts';

import { WebEditorForm, usePreventExit } from '@@/WebEditorForm';
import { FormActions } from '@@/form-components/FormActions';
import { Button } from '@@/buttons';
import { FormError } from '@@/form-components/FormError';

import { useParseTemplateOnFileChange } from '../useParseTemplateOnFileChange';

import { FormValues } from './types';

export function InnerForm({
  isLoading,
  isEditorReadonly,
  gitFileContent,
  gitFileError,
  refreshGitFile,
}: {
  isLoading: boolean;
  isEditorReadonly: boolean;
  gitFileContent?: string;
  gitFileError?: string;
  refreshGitFile: () => void;
}) {
  const {
    values,
    initialValues,
    setFieldValue,
    errors,
    isValid,
    setValues,
    isSubmitting,
    dirty,
  } = useFormikContext<FormValues>();
  usePreventExit(
    initialValues.FileContent,
    values.FileContent,
    !isEditorReadonly && !isSubmitting && !isLoading
  );

  const handleChangeFileContent = useParseTemplateOnFileChange(
    values.Variables
  );

  const texts = textByType[values.Type];

  return (
    <Form className="form-horizontal">
      <CommonFields
        values={values}
        onChange={(newValues) =>
          setValues((values) => ({ ...values, ...newValues }))
        }
        errors={errors}
      />

      {values.Type !== StackType.Kubernetes && (
        <>
          <PlatformField
            value={values.Platform}
            onChange={(value) => setFieldValue('Platform', value)}
          />

          <TemplateTypeSelector
            value={values.Type}
            onChange={(value) => setFieldValue('Type', value)}
          />
        </>
      )}

      <WebEditorForm
        data-cy="custom-template-editor"
        id="edit-custom-template-editor"
        value={gitFileContent || values.FileContent}
        onChange={handleChangeFileContent}
        type="yaml"
        textTip={
          gitFileContent
            ? 'Preview of the file from git repository'
            : texts.editor.placeholder
        }
        error={errors.FileContent}
        readonly={isEditorReadonly}
      >
        {texts.editor.description}
      </WebEditorForm>

      {values.Git && (
        <>
          <GitForm
            value={values.Git}
            onChange={(newValues) =>
              setValues((values) => ({
                ...values,
                // set ! for values.Git because this callback will only be called when it's defined (see L94)
                Git: { ...values.Git!, ...newValues },
              }))
            }
            deployMethod={
              values.Type === StackType.Kubernetes ? 'manifest' : 'compose'
            }
            errors={typeof errors.Git === 'object' ? errors.Git : undefined}
          />
          <div className="form-group">
            <div className="col-sm-12">
              <Button
                color="light"
                icon={RefreshCw}
                onClick={refreshGitFile}
                data-cy="custom-template-edit-reload-git-file-button"
              >
                Reload custom template
              </Button>
            </div>
            {gitFileError && (
              <div className="col-sm-12">
                <FormError>
                  Custom template could not be loaded, {gitFileError}.
                </FormError>
              </div>
            )}
          </div>
        </>
      )}

      {isTemplateVariablesEnabled && (
        <CustomTemplatesVariablesDefinitionField
          value={values.Variables}
          onChange={(values) => setFieldValue('Variables', values)}
          isVariablesNamesFromParent={!isEditorReadonly}
          errors={errors.Variables}
        />
      )}

      <FormActions
        isLoading={isLoading}
        isValid={isValid && dirty}
        loadingText="Updating custom template..."
        submitLabel="Update custom template"
        data-cy="custom-template-edit-submit-button"
      />
    </Form>
  );
}
