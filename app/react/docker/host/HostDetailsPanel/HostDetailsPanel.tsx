import { humanize } from '@/portainer/filters/filters';

import { Widget } from '@@/Widget/Widget';
import { WidgetBody } from '@@/Widget/WidgetBody';
import { WidgetTitle } from '@@/Widget/WidgetTitle';
import { DetailsTable } from '@@/DetailsTable/DetailsTable';

type HostOs = {
  type: string;
  arch: string;
  name: string;
};

type HostInfo = {
  name: string;
  os?: HostOs;
  kernelVersion?: string;
  totalCPU: number;
  totalMemory: number;
};

type Props = {
  host: HostInfo;
};

// The host filesystem browser (and its Browse button) is removed (TAI-009).
export function HostDetailsPanel({ host }: Props) {
  return (
    <div className="row">
      <div className="col-lg-12 col-md-12 col-sm-12 col-xs-12">
        <Widget>
          <WidgetTitle title="Host Details" icon="code" />
          <WidgetBody className="no-padding">
            <DetailsTable dataCy="host-details" className="!mb-0">
              <tr>
                <td>Hostname</td>
                <td>{host.name}</td>
              </tr>
              {host.os && (
                <tr>
                  <td>OS Information</td>
                  <td>
                    {host.os.type} {host.os.arch} {host.os.name}
                  </td>
                </tr>
              )}
              {host.kernelVersion && (
                <tr>
                  <td>Kernel Version</td>
                  <td>{host.kernelVersion}</td>
                </tr>
              )}
              <tr>
                <td>Total CPU</td>
                <td>{host.totalCPU}</td>
              </tr>
              <tr>
                <td>Total memory</td>
                <td>{humanize(host.totalMemory)}</td>
              </tr>
            </DetailsTable>
          </WidgetBody>
        </Widget>
      </div>
    </div>
  );
}
