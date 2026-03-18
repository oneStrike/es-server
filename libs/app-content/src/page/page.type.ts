import type { AppPage } from '@db/schema'

/**
 * 创建页面入参。
 * - 对应页面配置必填字段
 */
export type CreateAppPageInput = Pick<
  AppPage,
  'code' | 'path' | 'name' | 'title' | 'enablePlatform' | 'accessLevel' | 'isEnabled'
> &
Partial<Pick<AppPage, 'description'>>

/**
 * 更新页面入参。
 * - 以页面ID定位并按需更新字段
 */
export type UpdateAppPageInput = Pick<AppPage, 'id'> &
  Partial<
    Pick<
      AppPage,
      'code' | 'path' | 'name' | 'title' | 'enablePlatform' | 'accessLevel' | 'isEnabled' | 'description'
    >
  >

/**
 * 页面分页查询入参。
 * - 支持名称、编码、权限、启用状态与平台筛选
 * - 分页参数与 PageDto 语义保持一致
 */
export interface AppPageQueryInput {
  name?: string
  code?: string
  accessLevel?: number
  isEnabled?: boolean
  enablePlatform?: string
  pageIndex?: number
  pageSize?: number
}
