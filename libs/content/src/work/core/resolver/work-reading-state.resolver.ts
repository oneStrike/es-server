import type { Db } from '@db/core'
import type { IReadingStateResolver } from '@libs/interaction/reading-state/interfaces/reading-state-resolver.interface'
import { DrizzleService } from '@db/core'
import { ReadingStateService } from '@libs/interaction/reading-state/reading-state.service'
import { ContentTypeEnum } from '@libs/platform/constant'
import { Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 作品阅读状态解析器
 * 处理漫画和小说作品的阅读状态同步
 */
@Injectable()
export class WorkReadingStateResolver
  implements IReadingStateResolver, OnModuleInit
{
  /**
   * 支持的作品类型列表
   * 注意：这个 Resolver 逻辑上可以处理多种作品类型，
   * 但通常我们会为每种类型注册一个解析器。
   * 这里我们注册漫画类型，如果小说逻辑一致，也可以复用或单独写。
   * 考虑到 registerResolver 目前是一对一映射，我们这里默认为 COMIC 注册，
   * 并在 onModuleInit 中注册两次(COMIC 和 NOVEL)。
   */
  readonly workType = ContentTypeEnum.COMIC

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly readingStateService: ReadingStateService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.readingStateService.registerResolver(this)
    // 如果小说也走这套逻辑，也注册一下 (旧模型中 work 类型包含了漫画和小说)
    this.readingStateService.registerResolver({
      ...this,
      workType: ContentTypeEnum.NOVEL,
    } as WorkReadingStateResolver)
  }

  /**
   * 解析章节快照
   */
  async resolveChapterSnapshot(
    _tx: Db | undefined,
    workId: number,
    chapterId: number,
  ) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: {
        id: chapterId,
        workId,
      },
      columns: {
        id: true,
        title: true,
        subtitle: true,
        cover: true,
        sortOrder: true,
        deletedAt: true,
      },
    })
    if (!chapter) {
      return undefined
    }
    return {
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.subtitle,
      cover: chapter.cover,
      sortOrder: chapter.sortOrder,
      shouldDelete: Boolean(chapter.deletedAt),
    }
  }

  async resolveChapterSnapshots(
    refs: Array<{ workId: number, chapterId: number }>,
  ) {
    if (refs.length === 0) {
      return []
    }

    const chapterIds = [...new Set(refs.map((ref) => ref.chapterId))]
    const chapters = await this.db.query.workChapter.findMany({
      where: {
        id: { in: chapterIds },
      },
      columns: {
        id: true,
        workId: true,
        title: true,
        subtitle: true,
        cover: true,
        sortOrder: true,
        deletedAt: true,
      },
    })
    const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]))

    return refs.map((ref) => {
      const chapter = chapterMap.get(ref.chapterId)
      const snapshot =
        chapter && chapter.workId === ref.workId
          ? {
              id: chapter.id,
              title: chapter.title,
              subtitle: chapter.subtitle,
              cover: chapter.cover,
              sortOrder: chapter.sortOrder,
              shouldDelete: Boolean(chapter.deletedAt),
            }
          : undefined

      return {
        workId: ref.workId,
        chapterId: ref.chapterId,
        snapshot,
      }
    })
  }

  /**
   * 解析作品快照列表
   *
   * @param workIds - 作品ID列表
   * @returns 作品快照列表
   */
  async resolveWorkSnapshots(workIds: number[]) {
    if (workIds.length === 0) {
      return []
    }

    const works = await this.db.query.work.findMany({
      where: {
        id: { in: workIds },
      },
      columns: {
        id: true,
        type: true,
        name: true,
        cover: true,
        serialStatus: true,
        deletedAt: true,
      },
    })

    return works.map((w) => ({
      id: w.id,
      type: w.type,
      name: w.name,
      cover: w.cover,
      serialStatus: w.serialStatus,
      shouldDelete: Boolean(w.deletedAt),
    }))
  }

  /**
   * 根据章节ID获取作品关联信息
   *
   * @param chapterId - 章节ID
   * @returns 作品关联信息，包含作品ID和类型
   */
  async resolveWorkInfoByChapter(chapterId: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId },
      columns: {
        id: true,
        workId: true,
        workType: true,
        deletedAt: true,
      },
    })

    if (!chapter || chapter.deletedAt) {
      return undefined
    }

    return {
      workId: chapter.workId,
      workType: chapter.workType as ContentTypeEnum,
    }
  }
}
