import type { PrismaTransactionClientType } from '@libs/platform/database'
import type { BrowseLogTargetTypeEnum } from '../browse-log.constant'

/**
 * 浏览日志目标解析器接口
 * 负责处理不同类型目标的浏览日志相关逻辑
 */
export interface IBrowseLogTargetResolver {
  /** 目标类型 */
  readonly targetType: BrowseLogTargetTypeEnum

  /**
   * 应用浏览计数增量
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标ID
   * @param delta - 变更量
   */
  applyCountDelta: (
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) => Promise<void>

  /**
   * 校验目标是否有效且可以计入浏览日志
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标ID
   */
  ensureTargetValid: (
    tx: PrismaTransactionClientType,
    targetId: number,
  ) => Promise<void>
}
