import type {
  DictionaryItemSelect,
  DictionarySelect,
} from '@db/schema'

/**
 * 字典分页查询入参。
 * - 支持编码、名称与启用状态筛选
 * - 分页参数与 PageDto 语义保持一致
 */
export interface DictionaryPageQueryInput {
  code?: string
  name?: string
  isEnabled?: boolean
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

/**
 * 字典项分页查询入参。
 * - 在基础筛选上必须指定字典编码
 */
export interface DictionaryItemPageQueryInput extends DictionaryPageQueryInput {
  dictionaryCode: string
}

/**
 * 创建字典入参。
 * - 使用字典实体字段构建
 */
export type CreateDictionaryInput = Pick<
  DictionarySelect,
  'name' | 'code'
> &
Partial<Pick<DictionarySelect, 'cover' | 'isEnabled' | 'description'>>

/**
 * 更新字典入参。
 * - 通过ID定位并按需更新字段
 */
export type UpdateDictionaryInput = Pick<DictionarySelect, 'id'> &
  Partial<Pick<DictionarySelect, 'name' | 'code' | 'cover' | 'isEnabled' | 'description'>>

/**
 * 创建字典项入参。
 * - 使用字典项实体字段构建
 */
export type CreateDictionaryItemInput = Pick<
  DictionaryItemSelect,
  'dictionaryCode' | 'name' | 'code'
> &
Partial<Pick<DictionaryItemSelect, 'sortOrder' | 'cover' | 'isEnabled' | 'description'>>

/**
 * 更新字典项入参。
 * - 通过ID定位并按需更新字段
 */
export type UpdateDictionaryItemInput = Pick<DictionaryItemSelect, 'id'> &
  Pick<DictionaryItemSelect, 'dictionaryCode'> &
  Partial<
    Pick<
      DictionaryItemSelect,
      'name' | 'code' | 'sortOrder' | 'cover' | 'isEnabled' | 'description'
    >
  >

/**
 * 字典启用状态更新入参。
 * - 用于字典或字典项的启用禁用切换
 */
export interface UpdateDictionaryEnabledInput {
  id: number
  isEnabled: boolean
}

/**
 * 字典项拖拽排序入参。
 * - 通过 dragId 与 targetId 表达交换排序目标
 */
export interface DictionaryDragReorderInput {
  dragId: number
  targetId: number
}
