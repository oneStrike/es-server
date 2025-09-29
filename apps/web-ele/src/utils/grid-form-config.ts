/**
 * 搜索表单公共配置
 * 用于统一管理 VxeGrid 的搜索表单 formOptions 配置
 */

import type { VbenFormProps, VbenFormSchema } from '@vben/common-ui';

/**
 * 默认的搜索表单配置
 */
export const DEFAULT_SEARCH_FORM_OPTIONS: Omit<VbenFormProps, 'schema'> = {
  wrapperClass:
    'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4',
  compact: true,
  showCollapseButton: true,
  submitOnChange: true,
  collapsed: true,
};

/**
 * 创建搜索表单配置
 * @param schema 表单schema
 * @param overrides 覆盖配置
 * @returns 完整的表单配置
 */
export function createSearchFormOptions(
  schema: VbenFormSchema[],
  overrides?: Partial<VbenFormProps>,
): VbenFormProps {
  return {
    ...DEFAULT_SEARCH_FORM_OPTIONS,
    ...overrides,
    schema: schema.map((item) => {
      item.hideLabel = true;
      return item;
    }),
  };
}
