import type {
  Dictionary,
  DictionaryItem,
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
  Dictionary,
  'name' | 'code'
> &
Partial<Pick<Dictionary, 'cover' | 'isEnabled' | 'description'>>

/**
 * 更新字典入参。
 * - 通过ID定位并按需更新字段
 */
export type UpdateDictionaryInput = Pick<Dictionary, 'id'> &
  Partial<Pick<Dictionary, 'name' | 'code' | 'cover' | 'isEnabled' | 'description'>>

/**
 * 创建字典项入参。
 * - 使用字典项实体字段构建
 */
export type CreateDictionaryItemInput = Pick<
  DictionaryItem,
  'dictionaryCode' | 'name' | 'code'
> &
Partial<Pick<DictionaryItem, 'sortOrder' | 'cover' | 'isEnabled' | 'description'>>

/**
 * 更新字典项入参。
 * - 通过ID定位并按需更新字段
 */
export type UpdateDictionaryItemInput = Pick<DictionaryItem, 'id'> &
  Pick<DictionaryItem, 'dictionaryCode'> &
  Partial<
    Pick<
      DictionaryItem,
      'name' | 'code' | 'sortOrder' | 'cover' | 'isEnabled' | 'description'
    >
  >
