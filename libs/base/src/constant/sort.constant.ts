/**
 * 排序相关常量定义
 */

/**
 * 排序顺序枚举
 */
export enum SortOrderEnum {
  /** 升序 */
  ASC = 'asc',
  /** 降序 */
  DESC = 'desc',
}

/**
 * 排序顺序名称映射
 */
export const SortOrderNames: Record<SortOrderEnum, string> = {
  [SortOrderEnum.ASC]: '升序',
  [SortOrderEnum.DESC]: '降序',
}
