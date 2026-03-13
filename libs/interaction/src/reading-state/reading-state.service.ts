import { ContentTypeEnum } from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'
import { Injectable, Logger } from '@nestjs/common'
import { QueryReadingHistoryDto } from './dto/reading-state.dto'

@Injectable()
export class ReadingStateService extends PlatformService {
  private readonly logger = new Logger(ReadingStateService.name)

  get userWorkReadingState() {
    return this.prisma.userWorkReadingState
  }

  get workChapter() {
    return this.prisma.workChapter
  }

  /**
   * 解析可继续阅读的章节
   * 校验章节是否有效（未删除且属于目标作品）
   * @param workId - 作品ID
   * @param chapter - 章节信息
   * @returns 有效的章节快照，无效则返回 undefined
   */
  private resolveContinueChapter(
    workId: number,
    chapter?: {
      id: number
      title: string
      subtitle: string | null
      sortOrder: number
      cover: string | null
      workId: number
      deletedAt: Date | null
    } | null,
  ) {
    // 章节不存在、已删除或不属于目标作品时，返回 undefined
    if (!chapter || chapter.deletedAt !== null || chapter.workId !== workId) {
      return undefined
    }

    return {
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.subtitle,
      cover: chapter.cover,
      sortOrder: chapter.sortOrder,
    }
  }

  /**
   * 获取用户的阅读状态
   * @param userId - 用户ID
   * @param workId - 作品ID
   * @param workType - 作品类型（漫画/小说）
   * @returns 阅读状态快照，不存在则返回 null
   */
  async getReadingState(
    workType: ContentTypeEnum,
    workId: number,
    userId: number,
  ) {
    const state = await this.userWorkReadingState.findUnique({
      where: {
        userId_workId: {
          userId,
          workId,
        },
      },
      include: {
        lastReadChapter: {
          select: {
            id: true,
            title: true,
            subtitle: true,
            sortOrder: true,
            workId: true,
            cover: true,
            deletedAt: true,
          },
        },
      },
    })

    if (!state || state.workType !== workType) {
      return null
    }

    return {
      lastReadAt: state.lastReadAt,
      continueChapter: this.resolveContinueChapter(
        workId,
        state.lastReadChapter,
      ),
    }
  }

  /**
   * 更新阅读状态（按作品）
   * 创建或更新用户的阅读记录
   * @param params - 阅读状态参数
   */
  async touchByWork(params: {
    userId: number
    workId: number
    workType: ContentTypeEnum
    lastReadChapterId?: number
    lastReadAt?: Date
  }) {
    const {
      userId,
      workId,
      workType,
      lastReadChapterId,
      lastReadAt = new Date(),
    } = params

    return this.userWorkReadingState.upsert({
      where: {
        userId_workId: {
          userId,
          workId,
        },
      },
      create: {
        userId,
        workId,
        workType,
        lastReadAt,
        lastReadChapterId,
      },
      update: {
        workType,
        lastReadAt,
        lastReadChapterId,
      },
    })
  }

  /**
   * 安全地更新阅读状态（按作品）
   * 捕获异常并记录警告日志，不影响主流程
   * @param params - 阅读状态参数
   */
  async touchByWorkSafely(params: {
    userId: number
    workId: number
    workType: ContentTypeEnum
    lastReadChapterId?: number
    lastReadAt?: Date
  }) {
    try {
      await this.touchByWork(params)
    } catch (error) {
      this.logger.warn(
        `同步阅读快照失败 userId=${params.userId} workId=${params.workId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  /**
   * 更新阅读状态（按章节）
   * 根据章节ID自动推断作品类型并更新阅读记录
   * @param userId - 用户ID
   * @param chapterId - 章节ID
   */
  async touchByChapter(userId: number, chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        workId: true,
        workType: true,
        deletedAt: true,
      },
    })

    // 章节不存在或已删除时直接返回
    if (!chapter || chapter.deletedAt !== null) {
      return
    }

    await this.touchByWork({
      userId,
      workId: chapter.workId,
      workType: chapter.workType as ContentTypeEnum,
      lastReadChapterId: chapter.id,
    })
  }

  /**
   * 安全地更新阅读状态（按章节）
   * 捕获异常并记录警告日志，不影响主流程
   * @param userId - 用户ID
   * @param chapterId - 章节ID
   */
  async touchByChapterSafely(userId: number, chapterId: number) {
    try {
      await this.touchByChapter(userId, chapterId)
    } catch (error) {
      this.logger.warn(
        `同步章节阅读快照失败 userId=${userId} chapterId=${chapterId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  /**
   * 获取用户的阅读历史列表
   * @param dto - 查询参数
   * @returns 分页的阅读历史记录，包含作品信息和可继续阅读的章节
   */
  async getUserReadingHistory(dto: QueryReadingHistoryDto) {
    const { workType, ...otherDto } = dto
    const page = await this.userWorkReadingState.findPagination({
      where: {
        ...otherDto,
        ...(workType !== undefined && { workType }),
      },
      orderBy: { lastReadAt: 'desc' },
      include: {
        lastReadChapter: {
          select: {
            id: true,
            title: true,
            subtitle: true,
            sortOrder: true,
            cover: true,
            workId: true,
            deletedAt: true,
          },
        },
      },
    } as any)

    // 提取需要查询的作品ID列表
    const workIds = [...new Set(page.list.map((item: any) => item.workId))]

    // 批量查询作品信息
    const works = workIds.length
      ? await this.prisma.work.findMany({
          where: {
            id: { in: workIds },
            deletedAt: null,
          },
          select: {
            id: true,
            type: true,
            name: true,
            cover: true,
            serialStatus: true,
          },
        })
      : []

    // 构建作品ID到作品信息的映射
    const workMap = new Map(works.map((work) => [work.id, work]))

    return {
      ...page,
      list: page.list
        .map((item: any) => {
          const work = workMap.get(item.workId)
          // 找不到对应作品时过滤掉该记录
          if (!work) {
            return null
          }
          const continueChapter = this.resolveContinueChapter(
            item.workId,
            item.lastReadChapter,
          )
          return {
            workId: item.workId,
            workType: item.workType,
            lastReadAt: item.lastReadAt,
            lastReadChapterId: item.lastReadChapterId,
            work,
            continueChapter,
          }
        })
        .filter((item: any) => item !== null),
    }
  }

  /**
   * 删除单条阅读历史记录
   * @param id - 阅读记录ID
   * @param userId - 用户ID（可选，用于权限校验）
   */
  async deleteUserReadingHistory(id: number, userId?: number) {
    await this.userWorkReadingState.delete({
      where: {
        id,
        userId,
      },
    })
  }

  /**
   * 清空用户的阅读历史
   * @param userId - 用户ID
   * @param workType - 作品类型（可选，指定则只清空该类型的记录）
   */
  async clearUserReadingHistory(userId: number, workType?: ContentTypeEnum) {
    await this.userWorkReadingState.deleteMany({
      where: {
        userId,
        workType,
      },
    })
  }
}
