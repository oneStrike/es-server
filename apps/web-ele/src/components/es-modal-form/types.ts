import type { VbenFormProps } from '@vben/common-ui';

import type { EsFormSchema } from '#/types';

export interface EsModalFormProps {
  cols?: number;
  title?: string;
  width?: number;
  record?: Record<string, any>;
  // 表单配置项，props和sharedData必须传一个
  schema?: EsFormSchema;
  bitMaskField?: string[];
  fieldMappingTime?: VbenFormProps['fieldMappingTime'];
  onSubmit?: (values: Record<string, any>) => Promise<void> | void;
}
