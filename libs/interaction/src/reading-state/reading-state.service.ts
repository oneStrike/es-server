import { DrizzleService } from '@db/core'
import { ContentTypeEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { QueryReadingHistoryDto } from './dto/reading-state.dto'
import {
  IReadingStateResolver,
  ReadingStateChapterSnapshot,
  ReadingStateWorkSnapshot,
} from './interfaces/reading-state-resolver.interface'

@Injectable()
export class ReadingStateService {
  private readonly logger = new Logger(ReadingStateService.name)
  private readonly resolvers = new Map<ContentTypeEnum, IReadingStateResolver>()

  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get userWorkReadingState() {
    return this.drizzle.schema.userWorkReadingState
  }

  /**
   * 注册阅读状态解析器
   */
  registerResolver(resolver: IReadingStateResolver) {
    if (this.resolvers.has(resolver.workType)) {
      console.warn(
        `ReadingState resolver for type ${resolver.workType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.workType, resolver)
  }

  /**
   * 获取指定的阅读状态解析器
   */
  private getResolver(workType: ContentTypeEnum): IReadingStateResolver {
    const resolver = this.resolvers.get(workType)
    if (!resolver) {
      throw new BadRequestException('不支持的阅读状态业务类型')
    }
    return resolver
  }

  /**
   * 获取用户的阅读状态
   */
  async getReadingState(
    workType: ContentTypeEnum,
    workId: number,
    userId: number,
  ) {
    const resolver = this.getResolver(workType)

    const state = await this.db.query.userWorkReadingState.findFirst({
      where: {
        userId,
        workId,
        workType,
      },
    })

    if (!state) {
      return null
    }

    const continueChapter = state.lastReadChapterId
      ? await resolver.resolveChapterSnapshot(
          undefined,
          workId,
          state.lastReadChapterId,
        )
      : undefined

    return {
      lastReadAt: state.lastReadAt,
      continueChapter,
    }
  }

  /**
   * 更新阅读状态（按作品）
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

    // 预研：确保解析器存在
    this.getResolver(workType)

    const rows = await this.db
      .insert(this.userWorkReadingState)
      .values({
        userId,
        workId,
        workType,
        lastReadAt,
        lastReadChapterId,
      })
      .onConflictDoUpdate({
        target: [
          this.userWorkReadingState.userId,
          this.userWorkReadingState.workId,
        ],
        set: {
          workType,
          lastReadAt,
          lastReadChapterId,
        },
      })
      .returning()

    return rows[0]
  }

  /**
   * 安全地更新阅读状态（按作品）
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
   */
  async touchByChapter(userId: number, chapterId: number) {
    // 寻找哪个 resolver 能处理这个章节
    let workInfo: { workId: number; workType: ContentTypeEnum } | undefined

    for (const resolver of this.resolvers.values()) {
      workInfo = await resolver.resolveWorkInfoByChapter(chapterId)
      if (workInfo) {
        break
      }
    }

    if (!workInfo) {
      return
    }

    await this.touchByWork({
      userId,
      workId: workInfo.workId,
      workType: workInfo.workType,
      lastReadChapterId: chapterId,
    })
  }

  /**
   * 安全地更新阅读状态（按章节）
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
   */
  async getUserReadingHistory(dto: QueryReadingHistoryDto) {
    const { workType, userId, workId, pageIndex, pageSize } = dto
    const page = await this.drizzle.ext.findPagination(
      this.userWorkReadingState,
      {
        where: this.drizzle.buildWhere(this.userWorkReadingState, {
          and: {
            userId,
            workId,
            workType,
          },
        }),
        orderBy: { lastReadAt: 'desc' },
        pageIndex,
        pageSize,
      },
    )

    // 按作品类型分组处理作品信息和章节信息
    const list: Array<{
      workId: number
      workType: number
      lastReadAt: Date
      lastReadChapterId: number | null
      work: ReadingStateWorkSnapshot
      continueChapter: ReadingStateChapterSnapshot | undefined
    }> = []
    const typeGroups = new Map<
      ContentTypeEnum,
      Array<{
        workId: number
        workType: number
        lastReadAt: Date
        lastReadChapterId: number | null
      }>
    >()

    for (const item of page.list) {
      const type = item.workType as ContentTypeEnum
      if (!typeGroups.has(type)) {
        typeGroups.set(type, [])
      }
      typeGroups.get(type)!.push(item)
    }

    // 聚合处理各组
    for (const [type, items] of typeGroups) {
      const resolver = this.resolvers.get(type)
      if (!resolver) {
        continue
      }

      const workIds = [...new Set(items.map((i) => i.workId))]
      const works = await resolver.resolveWorkSnapshots(workIds)
      const workMap = new Map(works.map((w) => [w.id, w]))
      const chapterIdToWorkId = new Map<number, number>()
      for (const item of items) {
        if (
          typeof item.lastReadChapterId === 'number' &&
          !chapterIdToWorkId.has(item.lastReadChapterId)
        ) {
          chapterIdToWorkId.set(item.lastReadChapterId, item.workId)
        }
      }
      const chapterSnapshots = await Promise.all(
        Array.from(
          chapterIdToWorkId.entries(),
          async ([chapterId, chapterWorkId]) => ({
            chapterId,
            snapshot: await resolver.resolveChapterSnapshot(
              undefined,
              chapterWorkId,
              chapterId,
            ),
          }),
        ),
      )
      const chapterMap = new Map(
        chapterSnapshots.map((item) => [item.chapterId, item.snapshot]),
      )

      for (const item of items) {
        const work = workMap.get(item.workId)
        if (!work) {
          continue
        }

        const continueChapter = item.lastReadChapterId
          ? chapterMap.get(item.lastReadChapterId)
          : undefined

        list.push({
          workId: item.workId,
          workType: item.workType,
          lastReadAt: item.lastReadAt,
          lastReadChapterId: item.lastReadChapterId,
          work,
          continueChapter,
        })
      }
    }

    // 重新排序，因为分组处理打乱了顺序
    list.sort((a, b) => b.lastReadAt.getTime() - a.lastReadAt.getTime())

    return {
      ...page,
      list,
    }
  }

  /**
   * 删除单条阅读历史记录
   */
  async deleteUserReadingHistory(id: number, userId?: number) {
    await this.db
      .delete(this.userWorkReadingState)
      .where(
        userId === undefined
          ? eq(this.userWorkReadingState.id, id)
          : and(
              eq(this.userWorkReadingState.id, id),
              eq(this.userWorkReadingState.userId, userId),
            ),
      )
  }

  /**
   * 清空用户的阅读历史
   */
  async clearUserReadingHistory(userId: number, workType?: ContentTypeEnum) {
    await this.db
      .delete(this.userWorkReadingState)
      .where(
        workType === undefined
          ? eq(this.userWorkReadingState.userId, userId)
          : and(
              eq(this.userWorkReadingState.userId, userId),
              eq(this.userWorkReadingState.workType, workType),
            ),
      )
  }
}
