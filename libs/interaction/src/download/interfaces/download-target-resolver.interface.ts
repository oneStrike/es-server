import type { Db } from '@db/core'
import type { DownloadTargetTypeEnum } from '../download.constant'

/**
 * 下载目标解析器接口
 * 用于不同业务模块实现各自的下载校验和计数逻辑
 */
export interface IDownloadTargetResolver {
  /**
   * 目标类型标识
   */
  readonly targetType: DownloadTargetTypeEnum

  /**
   * 检查下载目标是否存在，并在必要时返回下载内容
   * @param tx - 事务对象
   * @param targetId - 目标 ID
   * @returns 下载内容 (如章节内容字符串)
   * @throws BadRequestException 如果目标不存在或不可下载
   */
  ensureDownloadable: (
    tx: Db,
    targetId: number,
  ) => Promise<string>

  /**
   * 更新目标的下载统计数
   * @param tx - 事务对象
   * @param targetId - 目标 ID
   * @param delta - 增量 (+1)
   */
  applyCountDelta: (
    tx: Db,
    targetId: number,
    delta: number,
  ) => Promise<void>
}
