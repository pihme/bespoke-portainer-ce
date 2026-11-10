import { AutoUpdateModel } from '@/react/portainer/gitops/types';

import { SwitchField } from '@@/form-components/SwitchField';

import { AutoUpdateSettings } from './AutoUpdateSettings';

export function AutoUpdateFieldset({
  value,
  onChange,
  baseWebhookUrl,
  webhookId,
  webhooksDocs,
}: {
  value: AutoUpdateModel;
  onChange: (value: AutoUpdateModel) => void;
  // Inert since TAI-012 removed the BE-only Re-pull image and Force
  // redeployment teasers; callers still pass them.
  environmentType?: 'DOCKER' | 'KUBERNETES';
  isForcePullVisible?: boolean;
  baseWebhookUrl: string;
  webhookId: string;
  webhooksDocs?: string;
}) {
  return (
    <>
      <div className="form-group">
        <div className="col-sm-12">
          <SwitchField
            name="gitopsWebhook"
            data-cy="gitops-webhook-switch"
            checked={value.RepositoryAutomaticUpdates}
            label="Create a Webhook"
            tooltip="Enable a webhook to trigger an immediate redeployment on demand."
            labelClass="col-sm-3 col-lg-2"
            onChange={(value) =>
              handleChange({ RepositoryAutomaticUpdates: value })
            }
          />
        </div>
      </div>

      {value.RepositoryAutomaticUpdates && (
        <AutoUpdateSettings
          webhookId={webhookId}
          baseWebhookUrl={baseWebhookUrl}
          webhookDocs={webhooksDocs}
        />
      )}
    </>
  );

  function handleChange(newValues: Partial<AutoUpdateModel>) {
    onChange({ ...value, ...newValues });
  }
}
