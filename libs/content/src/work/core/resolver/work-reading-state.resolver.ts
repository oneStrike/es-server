import {
  IReadingStateResolver,
  ReadingStateService,
} from '@libs/interaction'
import { ContentTypeEnum } from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'
import { Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 作品阅读状态解析器
 * 处理漫画和小说作品的阅读状态同步
 */
@Injectable()
export class WorkReadingStateResolver
  extends PlatformService
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

  constructor(private readonly readingStateService: ReadingStateService) {
    super()
  }

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.readingStateService.registerResolver(this)
    // 如果小说也走这套逻辑，也注册一下 (Prisma 中 work 类型包含了漫画和小说)
    this.readingStateService.registerResolver({
      ...this,
      workType: ContentTypeEnum.NOVEL,
    } as any)
  }

  /**
   * 解析章节快照
   */
  async resolveChapterSnapshot(
    _tx: any,
    workId: number,
    chapterId: number,
  ) {
    const chapter = await this.prisma.workChapter.findFirst({
      where: {
        id: chapterId,
        workId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        subtitle: true,
        cover: true,
        sortOrder: true,
      },
    })

    return chapter || undefined
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

    const works = await this.prisma.work.findMany({
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

    return works.map((w) => ({
      ...w,
      type: w.type,
    }))
  }

  /**
   * 根据章节ID获取作品关联信息
   *
   * @param chapterId - 章节ID
   * @returns 作品关联信息，包含作品ID和类型
   */
  async resolveWorkInfoByChapter(chapterId: number) {
    const chapter = await this.prisma.workChapter.findUnique({
      where: { id: chapterId },
      select: {
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
