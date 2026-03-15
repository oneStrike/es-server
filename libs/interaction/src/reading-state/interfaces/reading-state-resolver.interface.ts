import type { ContentTypeEnum } from '@libs/platform/constant'
import type { PrismaTransactionClientType } from '@libs/platform/database'

/**
 * 阅读状态中使用的章节快照
 */
export interface ReadingStateChapterSnapshot {
  id: number
  title: string
  subtitle: string | null
  cover: string | null
  sortOrder: number
}

/**
 * 阅读状态中使用的作品快照
 */
export interface ReadingStateWorkSnapshot {
  id: number
  type: number
  name: string
  cover: string
  serialStatus: number
}

/**
 * 阅读状态目标解析器接口
 */
export interface IReadingStateResolver {
  /**
   * 目标类型标识（作品类型）
   */
  readonly workType: ContentTypeEnum

  /**
   * 解析章节快照
   * @param tx - Prisma 事务(可选)
   * @param workId - 作品ID
   * @param chapterId - 章节ID
   */
  resolveChapterSnapshot: (
    tx: PrismaTransactionClientType | undefined,
    workId: number,
    chapterId: number,
  ) => Promise<ReadingStateChapterSnapshot | undefined>

  /**
   * 解析作品快照列表
   * @param workIds - 作品ID列表
   */
  resolveWorkSnapshots: (
    workIds: number[],
  ) => Promise<ReadingStateWorkSnapshot[]>

  /**
   * 根据章节ID获取作品关联信息
   * 用于 touchByChapter 逻辑
   */
  resolveWorkInfoByChapter: (
    chapterId: number,
  ) => Promise<{ workId: number, workType: ContentTypeEnum } | undefined>
}
