import type { AppAgreement } from '@db/schema'

/**
 * 创建协议入参。
 * - 用于新增协议基础信息
 */
export type CreateAgreementInput = Pick<
  AppAgreement,
  'title' | 'content' | 'version'
> &
Partial<Pick<AppAgreement, 'isForce' | 'showInAuth'>>

/**
 * 更新协议入参。
 * - 以协议ID定位并按需更新可变字段
 */
export type UpdateAgreementInput = Pick<AppAgreement, 'id'> &
  Partial<
    Pick<
      AppAgreement,
      | 'title'
      | 'content'
      | 'version'
      | 'isForce'
      | 'showInAuth'
      | 'isPublished'
      | 'publishedAt'
    >
  >

/**
 * 协议分页查询入参。
 * - 支持标题与发布状态筛选
 * - 分页参数与 PageDto 语义保持一致
 */
export interface AgreementPageQuery {
  title?: string
  isPublished?: boolean
  showInAuth?: boolean
  pageIndex?: number
  pageSize?: number
}

/**
 * 已发布协议查询入参。
 * - 按登录注册页展示开关筛选
 */
export type PublishedAgreementQuery = Partial<Pick<AppAgreement, 'showInAuth'>>

/**
 * 协议主键入参。
 * - 用于按 id 查询或删除协议
 */
export type AgreementIdInput = Pick<AppAgreement, 'id'>

/**
 * 协议发布状态更新入参。
 * - 仅用于切换协议发布状态
 */
export type UpdateAgreementPublishStatusInput = Pick<
  AppAgreement,
  'id' | 'isPublished'
>
