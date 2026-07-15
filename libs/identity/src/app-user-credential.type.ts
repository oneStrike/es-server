import type { DbTransaction } from '@db/core'
import type { AppUserSelect } from '@db/schema'

/** 注册初始化完成或依赖快照漂移的闭集执行结果。 */
export type AppUserRegistrationInitializationOutcome =
  'initialized' | 'snapshot-drift'

/**
 * 注册事务内由上层业务所有者执行的 canonical 初始化步骤。
 *
 * identity 只负责创建 levelId=null 的凭据；锁获取、资料、成长余额及读模型由调用方
 * 在同一事务中显式编排。
 */
export type AppUserRegistrationInitializer = (
  tx: DbTransaction,
  userId: number,
) => Promise<AppUserRegistrationInitializationOutcome>

/**
 * 登录与令牌签发所需的应用用户凭据视图。
 * 保持在身份域，避免应用入口直接依赖 app_user 表结构。
 */
export type AppLoginUserSource = Pick<
  AppUserSelect,
  | 'account'
  | 'avatarUrl'
  | 'banReason'
  | 'banUntil'
  | 'bio'
  | 'birthDate'
  | 'emailAddress'
  | 'genderType'
  | 'id'
  | 'isEnabled'
  | 'nickname'
  | 'password'
  | 'phoneNumber'
  | 'profileBackgroundImageUrl'
  | 'signature'
  | 'status'
>

/** 应用用户注册成功后的身份凭据结果。 */
export interface AppUserRegistrationSucceeded {
  outcome: 'registered'
  user: AppLoginUserSource
}

/** 初始化依赖快照发生漂移，调用方必须重新发现并开启新事务。 */
export interface AppUserRegistrationInitializationSnapshotDrift {
  outcome: 'initialization-snapshot-drift'
}

/** 应用用户注册的闭集执行结果。 */
export type AppUserRegistrationResult =
  AppUserRegistrationSucceeded | AppUserRegistrationInitializationSnapshotDrift

/** 应用用户找回密码前的最小状态视图。 */
export type AppPasswordResetUserSource = Pick<
  AppUserSelect,
  'id' | 'isEnabled' | 'status' | 'banReason' | 'banUntil'
>

/** 修改密码时校验旧密码所需的凭据视图。 */
export type AppPasswordCredentialSource = Pick<AppUserSelect, 'id' | 'password'>
