import { WorkTypeEnum } from '@libs/base/constant'

/// 作品连载状态枚举
export enum WorkSerialStatusEnum {
  /** 未开始 */
  NOT_STARTED = 0,
  /** 连载中 */
  SERIALIZING = 1,
  /** 已完结 */
  COMPLETED = 2,
  /** 暂停 */
  PAUSED = 3,
  /** 停更 */
  DISCONTINUED = 4,
}

/// 作品成长事件 Key
export const WorkGrowthEventKey = {
  View: 'work.view',
  Like: 'work.like',
  Favorite: 'work.favorite',
} as const

/// 作品类型映射（用于业务逻辑判断）
export const WorkTypeMap = {
  [WorkTypeEnum.COMIC]: '漫画',
  [WorkTypeEnum.NOVEL]: '小说',
} as const
