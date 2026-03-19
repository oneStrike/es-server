import type {
  ReadingHistoryIndexedRow,
  ReadingHistoryItem,
  ReadingHistoryQuery,
  TouchByWorkInput,
} from './reading-state.type'
import { DrizzleService } from '@db/core'
import { ContentTypeEnum, WorkTypeEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  IReadingStateResolver,
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

  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  private buildFallbackWorkSnapshot(
    workId: number,
    workType: number,
  ): ReadingStateWorkSnapshot {
    return {
      id: workId,
      type: workType,
      name: '',
      cover: '',
      serialStatus: 0,
      shouldDelete: true,
    }
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
  async touchByWork(params: TouchByWorkInput) {
    const {
      userId,
      workId,
      workType,
      lastReadChapterId,
      lastReadAt = new Date(),
    } = params

    // 预研：确保解析器存在
    this.getResolver(workType)

    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
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
        .returning(),
    )

    return rows[0]
  }

  /**
   * 安全地更新阅读状态（按作品）
   */
  async touchByWorkSafely(params: TouchByWorkInput) {
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
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId },
      columns: {
        workId: true,
        workType: true,
        deletedAt: true,
      },
    })

    if (!chapter || chapter.deletedAt) {
      return
    }

    await this.touchByWork({
      userId,
      workId: chapter.workId,
      workType: chapter.workType as ContentTypeEnum,
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
  async getUserReadingHistory(query: ReadingHistoryQuery) {
    const { workType, userId, workId, pageIndex, pageSize } = query
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

    const orderedList: Array<ReadingHistoryItem | undefined> = Array.from({
      length: page.list.length,
    })
    const typeGroups = new Map<
      ContentTypeEnum,
      ReadingHistoryIndexedRow[]
    >()

    for (const [index, item] of page.list.entries()) {
      const type = item.workType as ContentTypeEnum
      if (!typeGroups.has(type)) {
        typeGroups.set(type, [])
      }
      typeGroups.get(type)!.push({ ...item, index })
    }

    for (const [type, items] of typeGroups) {
      const resolver = this.resolvers.get(type)
      if (!resolver) {
        for (const item of items) {
          orderedList[item.index] = {
            workId: item.workId,
            workType: item.workType,
            lastReadAt: item.lastReadAt,
            lastReadChapterId: item.lastReadChapterId,
            work: this.buildFallbackWorkSnapshot(item.workId, item.workType),
            continueChapter: undefined,
          }
        }
        continue
      }

      const workIds = [...new Set(items.map((i) => i.workId))]
      const works = await resolver.resolveWorkSnapshots(workIds)
      const workMap = new Map(works.map((w) => [w.id, w]))
      const chapterRefsMap = new Map<number, { workId: number, chapterId: number }>()
      for (const item of items) {
        if (
          typeof item.lastReadChapterId === 'number' &&
          !chapterRefsMap.has(item.lastReadChapterId)
        ) {
          chapterRefsMap.set(item.lastReadChapterId, {
            workId: item.workId,
            chapterId: item.lastReadChapterId,
          })
        }
      }
      const chapterRefs = [...chapterRefsMap.values()]
      const chapterSnapshots = resolver.resolveChapterSnapshots
        ? await resolver.resolveChapterSnapshots(chapterRefs)
        : await Promise.all(
            chapterRefs.map(async ({ chapterId, workId }) => ({
              workId,
              chapterId,
              snapshot: await resolver.resolveChapterSnapshot(
                undefined,
                workId,
                chapterId,
              ),
            })),
          )
      const chapterMap = new Map(
        chapterSnapshots.map((item) => [item.chapterId, item.snapshot]),
      )

      for (const item of items) {
        const work
          = workMap.get(item.workId)
            ?? this.buildFallbackWorkSnapshot(item.workId, item.workType)

        const continueChapter = item.lastReadChapterId
          ? chapterMap.get(item.lastReadChapterId)
          : undefined

        orderedList[item.index] = {
          workId: item.workId,
          workType: item.workType,
          lastReadAt: item.lastReadAt,
          lastReadChapterId: item.lastReadChapterId,
          work,
          continueChapter,
        }
      }
    }

    const list = orderedList.filter(Boolean) as ReadingHistoryItem[]

    return {
      ...page,
      list,
    }
  }

  /**
   * 删除单条阅读历史记录
   */
  async deleteUserReadingHistory(id: number, userId?: number) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.userWorkReadingState)
        .where(
          userId === undefined
            ? eq(this.userWorkReadingState.id, id)
            : and(
                eq(this.userWorkReadingState.id, id),
                eq(this.userWorkReadingState.userId, userId),
              ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '阅读历史不存在')
  }

  /**
   * 清空用户的阅读历史
   */
  async clearUserReadingHistory(userId: number, workType?: WorkTypeEnum) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.userWorkReadingState)
        .where(
          workType === undefined
            ? eq(this.userWorkReadingState.userId, userId)
            : and(
                eq(this.userWorkReadingState.userId, userId),
                eq(this.userWorkReadingState.workType, workType),
              ),
        ),
    )
  }
}
