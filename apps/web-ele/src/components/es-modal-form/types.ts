import type { VbenFormProps } from '@vben/common-ui';

import type { EsFormSchema } from '#/types';

export interface EsModalFormProps {
  title?: string;
  width?: number;
  record?: Record<string, any>;
  schema: EsFormSchema;
  bitMaskField?: string[];
  fieldMappingTime?: VbenFormProps['fieldMappingTime'];
  onSubmit?: (values: Record<string, any>) => Promise<void> | void;
}
