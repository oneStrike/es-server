import type {
  ThirdPartyComicDetailDto,
  ThirdPartyComicImageDto,
  ThirdPartyComicImportChapterItemDto,
  ThirdPartyComicImportChapterResultDto,
  ThirdPartyComicImportRequestDto,
  ThirdPartyComicImportWorkDraftDto,
} from '@libs/content/work/content/dto/content.dto'
import type { ComicThirdPartyProvider } from '../providers/comic-third-party-provider.type'
import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service'
import { ComicContentService } from '@libs/content/work/content/comic-content.service'
import {
  ThirdPartyComicImportChapterActionEnum,
  ThirdPartyComicImportChapterStatusEnum,
  ThirdPartyComicImportCoverModeEnum,
  ThirdPartyComicImportCoverStatusEnum,
  ThirdPartyComicImportModeEnum,
  ThirdPartyComicImportPreviewRequestDto,
  ThirdPartyComicImportStatusEnum,
  ThirdPartyComicImportWorkStatusEnum,
} from '@libs/content/work/content/dto/content.dto'
import { WorkService } from '@libs/content/work/core/work.service'
import { WorkTypeEnum, WorkViewPermissionEnum } from '@libs/platform/constant'
import { formatDateOnlyInAppTimeZone } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { ComicThirdPartyRegistry } from '../providers/comic-third-party.registry'
import { RemoteImageImportService } from './remote-image-import.service'

@Injectable()
export class ThirdPartyComicImportService {
  // 注入导入所需的 provider、作品、章节、内容和远程图片服务。
  constructor(
    private readonly registry: ComicThirdPartyRegistry,
    private readonly workService: WorkService,
    private readonly workChapterService: WorkChapterService,
    private readonly comicContentService: ComicContentService,
    private readonly remoteImageImportService: RemoteImageImportService,
  ) {}

  // 预览第三方漫画导入方案，只读取 provider 数据不写入本地。
  async previewImport(dto: ThirdPartyComicImportPreviewRequestDto) {
    const provider = this.registry.resolve(dto.platform)
    const [detail, chapters] = await Promise.all([
      provider.getDetail(dto),
      provider.getChapters(dto),
    ])

    return {
      platform: dto.platform,
      comicId: dto.comicId,
      sourceSnapshot: {
        providerComicId: detail.id,
        pathWord: detail.pathWord,
        uuid: detail.uuid,
        fetchedAt: new Date().toISOString(),
      },
      detail,
      groups: detail.groups,
      chapters,
      workDraft: {
        name: detail.name,
        alias: detail.alias,
        description: detail.brief || detail.name,
        originalSource: `CopyManga:${detail.pathWord}`,
        remark: `三方导入：CopyManga ${detail.pathWord}`,
        suggestedRegion: detail.region,
        suggestedSerialStatus: this.resolveSuggestedSerialStatus(detail.status),
      },
      coverOptions: {
        provider: detail.cover
          ? {
              providerImageId: this.buildCoverProviderImageId(detail),
              url: detail.cover,
            }
          : undefined,
        localRequired: !detail.cover,
      },
      relationCandidates: {
        authors: detail.authors.map((providerName) => ({
          providerName,
          localCandidates: [],
        })),
        categories: detail.taxonomies.map((providerName) => ({
          providerName,
          localCandidates: [],
        })),
        tags: detail.taxonomies.map((providerName) => ({
          providerName,
          localCandidates: [],
        })),
      },
      missingLocalFields: [
        'authorIds',
        'categoryIds',
        'tagIds',
        'language',
        'region',
        'serialStatus',
        'viewRule',
      ],
    }
  }

  // 确认导入第三方漫画，并按章节粒度汇总成功和失败结果。
  async confirmImport(dto: ThirdPartyComicImportRequestDto) {
    const provider = this.registry.resolve(dto.platform)
    const detail = await provider.getDetail({
      comicId: dto.comicId,
      platform: dto.platform,
    })
    const preparedWork = await this.prepareWork(dto, detail)
    const workResult = preparedWork.work

    if (!workResult.id) {
      return {
        mode: dto.mode,
        status: ThirdPartyComicImportStatusEnum.FAILED,
        work: workResult,
        cover: preparedWork.cover,
        chapters: [],
      }
    }

    const chapterResults: ThirdPartyComicImportChapterResultDto[] = []
    for (const chapter of dto.chapters) {
      chapterResults.push(
        await this.importChapter(dto, chapter, workResult.id, provider),
      )
    }

    const hasFailedChapter = chapterResults.some(
      (chapter) =>
        chapter.status === ThirdPartyComicImportChapterStatusEnum.FAILED,
    )

    return {
      mode: dto.mode,
      status: hasFailedChapter
        ? ThirdPartyComicImportStatusEnum.PARTIAL_FAILED
        : ThirdPartyComicImportStatusEnum.SUCCESS,
      work: workResult,
      cover: preparedWork.cover,
      chapters: chapterResults,
    }
  }

  // 准备本地作品和封面，失败时返回可展示的导入结果而不抛出。
  private async prepareWork(
    dto: ThirdPartyComicImportRequestDto,
    detail: ThirdPartyComicDetailDto,
  ) {
    if (dto.mode === ThirdPartyComicImportModeEnum.ATTACH_TO_EXISTING) {
      if (!dto.targetWorkId) {
        return {
          cover: {
            status: ThirdPartyComicImportCoverStatusEnum.SKIPPED,
            message: '挂载已有作品不修改作品封面',
          },
          work: {
            status: ThirdPartyComicImportWorkStatusEnum.FAILED,
            errorCode: 'TARGET_WORK_REQUIRED',
            message: '挂载已有作品必须选择目标作品',
          },
        }
      }

      await this.workService.getWorkDetail(dto.targetWorkId, {
        bypassVisibilityCheck: true,
      })
      return {
        cover: {
          status: ThirdPartyComicImportCoverStatusEnum.SKIPPED,
          message: '挂载已有作品不修改作品封面',
        },
        work: {
          id: dto.targetWorkId,
          status: ThirdPartyComicImportWorkStatusEnum.ATTACHED,
          message: '已挂载到本地作品',
        },
      }
    }

    if (!dto.workDraft) {
      return {
        cover: {
          status: ThirdPartyComicImportCoverStatusEnum.FAILED,
          errorCode: 'WORK_DRAFT_REQUIRED',
          message: '新建作品必须提交作品草稿',
        },
        work: {
          status: ThirdPartyComicImportWorkStatusEnum.FAILED,
          errorCode: 'WORK_DRAFT_REQUIRED',
          message: '新建作品必须提交作品草稿',
        },
      }
    }

    let coverFailureMessage = '新建作品封面处理失败'
    let coverPath: string | undefined
    try {
      coverPath = await this.resolveWorkCoverPath(dto, detail)
    } catch (error) {
      coverFailureMessage =
        error instanceof Error ? error.message : coverFailureMessage
    }

    if (!coverPath) {
      return {
        cover: {
          status: ThirdPartyComicImportCoverStatusEnum.FAILED,
          errorCode: 'WORK_COVER_FAILED',
          message: coverFailureMessage,
        },
        work: {
          status: ThirdPartyComicImportWorkStatusEnum.FAILED,
          errorCode: 'WORK_COVER_REQUIRED',
          message: coverFailureMessage,
        },
      }
    }

    const workId = await this.workService.createWorkReturningId(
      this.toCreateWorkDto(dto.workDraft, coverPath),
    )

    return {
      cover: {
        status:
          dto.cover?.mode === ThirdPartyComicImportCoverModeEnum.LOCAL
            ? ThirdPartyComicImportCoverStatusEnum.LOCAL
            : ThirdPartyComicImportCoverStatusEnum.UPLOADED,
        filePath: coverPath,
        message: '作品封面处理成功',
      },
      work: {
        id: workId,
        status: ThirdPartyComicImportWorkStatusEnum.CREATED,
        message: '作品创建成功',
      },
    }
  }

  // 导入单个章节，章节失败不影响后续章节继续处理。
  private async importChapter(
    dto: ThirdPartyComicImportRequestDto,
    chapter: ThirdPartyComicImportChapterItemDto,
    workId: number,
    provider: ComicThirdPartyProvider,
  ) {
    try {
      const localChapterId = await this.prepareChapter(chapter, workId)
      const cover = await this.importChapterCover(chapter)

      if (!chapter.importImages) {
        return {
          providerChapterId: chapter.providerChapterId,
          localChapterId,
          action: chapter.action,
          status: ThirdPartyComicImportChapterStatusEnum.METADATA_ONLY,
          cover,
          imageTotal: 0,
          imageSucceeded: 0,
          message: '章节元数据已处理，未导入图片',
        }
      }

      if (
        chapter.action === ThirdPartyComicImportChapterActionEnum.UPDATE &&
        !chapter.overwriteContent
      ) {
        return {
          providerChapterId: chapter.providerChapterId,
          localChapterId,
          action: chapter.action,
          status: ThirdPartyComicImportChapterStatusEnum.FAILED,
          cover,
          errorCode: 'OVERWRITE_REQUIRED',
          message: '更新章节内容必须确认覆盖',
        }
      }

      const content = await provider.getChapterContent({
        chapterId: chapter.providerChapterId,
        comicId: dto.comicId,
        platform: dto.platform,
      })
      const filePaths = await this.remoteImageImportService.importImages(
        this.sortImages(content.images),
        ['work', 'comic', String(workId), 'chapter', String(localChapterId)],
      )
      await this.comicContentService.replaceChapterContents(
        localChapterId,
        filePaths,
      )

      return {
        providerChapterId: chapter.providerChapterId,
        localChapterId,
        action: chapter.action,
        status: ThirdPartyComicImportChapterStatusEnum.CONTENT_IMPORTED,
        cover,
        imageTotal: content.images.length,
        imageSucceeded: filePaths.length,
        message: '章节图片导入成功',
      }
    } catch (error) {
      return {
        providerChapterId: chapter.providerChapterId,
        localChapterId:
          chapter.action === ThirdPartyComicImportChapterActionEnum.UPDATE
            ? chapter.targetChapterId
            : undefined,
        action: chapter.action,
        status: ThirdPartyComicImportChapterStatusEnum.FAILED,
        imageTotal: 0,
        imageSucceeded: 0,
        errorCode: 'CHAPTER_IMPORT_FAILED',
        message: error instanceof Error ? error.message : '章节导入失败',
      }
    }
  }

  // 创建或更新本地章节元数据，并返回本地章节 ID。
  private async prepareChapter(
    chapter: ThirdPartyComicImportChapterItemDto,
    workId: number,
  ) {
    if (chapter.action === ThirdPartyComicImportChapterActionEnum.UPDATE) {
      if (!chapter.targetChapterId) {
        throw new Error('更新章节必须选择目标章节')
      }
      await this.workChapterService.updateChapter({
        id: chapter.targetChapterId,
        ...this.toChapterUpdate(chapter),
      })
      return chapter.targetChapterId
    }

    return this.workChapterService.createChapterReturningId({
      ...this.toChapterUpdate(chapter),
      workId,
      workType: WorkTypeEnum.COMIC,
    })
  }

  // 解析章节封面导入结果，CopyManga 当前不提供章节封面远程下载。
  private async importChapterCover(
    chapter: ThirdPartyComicImportChapterItemDto,
  ) {
    if (
      !chapter.cover ||
      chapter.cover.mode === ThirdPartyComicImportCoverModeEnum.SKIP
    ) {
      return {
        status: ThirdPartyComicImportCoverStatusEnum.SKIPPED,
        message: '章节封面未导入',
      }
    }
    if (chapter.cover.mode === ThirdPartyComicImportCoverModeEnum.LOCAL) {
      return {
        status: ThirdPartyComicImportCoverStatusEnum.LOCAL,
        filePath: chapter.cover.localPath,
        message: '使用本地章节封面',
      }
    }

    return {
      status: ThirdPartyComicImportCoverStatusEnum.FAILED,
      errorCode: 'CHAPTER_COVER_UNAVAILABLE',
      message: 'CopyManga 章节列表未提供章节封面',
    }
  }

  // 根据用户选择解析作品封面路径，provider 封面会先下载到本地上传。
  private async resolveWorkCoverPath(
    dto: ThirdPartyComicImportRequestDto,
    detail: ThirdPartyComicDetailDto,
  ) {
    if (dto.cover?.mode === ThirdPartyComicImportCoverModeEnum.LOCAL) {
      return dto.cover.localPath
    }

    if (
      dto.cover?.mode !== ThirdPartyComicImportCoverModeEnum.PROVIDER ||
      dto.cover.providerImageId !== this.buildCoverProviderImageId(detail) ||
      !detail.cover
    ) {
      return undefined
    }

    return this.remoteImageImportService.importImage(detail.cover, [
      'comic',
      'image',
      formatDateOnlyInAppTimeZone(new Date()),
    ])
  }

  // 将导入草稿转换为本地作品创建 DTO。
  private toCreateWorkDto(
    workDraft: ThirdPartyComicImportWorkDraftDto,
    cover: string,
  ) {
    return {
      ...workDraft,
      canComment: workDraft.canComment ?? true,
      chapterPrice: workDraft.chapterPrice ?? 0,
      cover,
      isHot: workDraft.isHot ?? false,
      isNew: workDraft.isNew ?? false,
      isPublished: workDraft.isPublished ?? false,
      isRecommended: workDraft.isRecommended ?? false,
      recommendWeight: workDraft.recommendWeight ?? 0,
      type: WorkTypeEnum.COMIC,
    }
  }

  // 将导入章节条目转换为本地章节创建或更新字段。
  private toChapterUpdate(chapter: ThirdPartyComicImportChapterItemDto) {
    return {
      canComment: chapter.canComment ?? true,
      canDownload: chapter.canDownload ?? true,
      cover:
        chapter.cover?.mode === ThirdPartyComicImportCoverModeEnum.LOCAL
          ? chapter.cover.localPath
          : undefined,
      isPreview: chapter.isPreview ?? false,
      isPublished: chapter.isPublished ?? false,
      price: chapter.price ?? 0,
      sortOrder: chapter.sortOrder,
      title: chapter.title,
      subtitle: chapter.subtitle,
      viewRule: chapter.viewRule ?? WorkViewPermissionEnum.INHERIT,
    }
  }

  // 按三方 sortOrder 保持图片导入顺序稳定。
  private sortImages(images: ThirdPartyComicImageDto[]) {
    return [...images].sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // 为 provider 封面生成导入请求中的稳定图片 ID。
  private buildCoverProviderImageId(detail: ThirdPartyComicDetailDto) {
    return `cover:${detail.id}`
  }

  // 将三方连载状态文本映射为本地作品连载状态值。
  private resolveSuggestedSerialStatus(status?: string) {
    if (!status) {
      return undefined
    }
    if (status.includes('完') || status.toLowerCase().includes('finish')) {
      return 2
    }
    if (status.includes('停') || status.toLowerCase().includes('pause')) {
      return 3
    }
    return 1
  }
}
