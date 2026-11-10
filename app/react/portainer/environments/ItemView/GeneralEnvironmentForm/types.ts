import { TLSConfig } from '@/react/components/TLSFieldset/types';

export interface GeneralEnvironmentFormValues {
  name: string;
  environmentUrl: string;
  publicUrl: string;

  tls?: TLSConfig;
}
