// 异步函数类型
import type { VbenFormSchema as FormSchema } from '@vben/common-ui';

import type { ComponentType } from '#/adapter/component';

export type AsyncFn = <T = any>(...args: any[]) => Promise<T>;

export type EsFormSchema = FormSchema<ComponentType>[];
