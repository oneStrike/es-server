import type { FastifyRequest } from 'fastify'
import { BadRequestException, Injectable } from '@nestjs/common'
import type {
  DeleteComicContentDto,
  MoveComicContentDto,
  UpdateComicContentDto,
  UploadContentDto,
} from './dto/content.dto'
import { ComicContentService } from './comic-content.service'
import { NovelContentService } from './novel-content.service'
import { IdDto } from '@libs/base/dto'

/// 内容类型枚举
export enum ContentType {
  COMIC = 'comic',
  NOVEL = 'novel',
}

/// 通用内容服务
/// 聚合Comic和Novel的通用方法，通过type参数区分
@Injectable()
export class WorkChapterContentService {
  constructor(
    private readonly comicContentService: ComicContentService,
    private readonly novelContentService: NovelContentService,
  ) {}

  /// 获取章节内容
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param chapterId - 章节ID
  /// @returns Comic返回数组，Novel返回字符串
  async getContent(type: ContentType, chapterId: number) {
    switch (type) {
      case ContentType.COMIC:
        return this.comicContentService.getChapterContents(chapterId)
      case ContentType.NOVEL:
        return this.novelContentService.getChapterContent(chapterId)
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }

  /// 上传/添加章节内容
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param req - Fastify请求对象
  /// @param query - 包含id和workId的查询参数
  async addContent(
    type: ContentType,
    req: FastifyRequest,
    query: UploadContentDto,
  ) {
    switch (type) {
      case ContentType.COMIC:
        return this.comicContentService.addChapterContent(req, query)
      case ContentType.NOVEL:
        return this.novelContentService.uploadChapterContent(req, query)
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }

  /// 更新章节内容（仅Comic支持）
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param body - 更新内容参数
  async updateContent(type: ContentType, body: UpdateComicContentDto) {
    switch (type) {
      case ContentType.COMIC:
        return this.comicContentService.updateChapterContent(body)
      case ContentType.NOVEL:
        throw new BadRequestException('Novel不支持更新内容操作')
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }

  /// 删除章节内容
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param dto - 删除参数
  async deleteContent(type: ContentType, dto: DeleteComicContentDto | IdDto) {
    switch (type) {
      case ContentType.COMIC:
        return this.comicContentService.deleteChapterContent(
          dto as DeleteComicContentDto,
        )
      case ContentType.NOVEL:
        return this.novelContentService.deleteChapterContent((dto as IdDto).id)
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }

  /// 移动章节内容（仅Comic支持）
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param body - 移动参数
  async moveContent(type: ContentType, body: MoveComicContentDto) {
    switch (type) {
      case ContentType.COMIC:
        return this.comicContentService.moveChapterContent(body)
      case ContentType.NOVEL:
        throw new BadRequestException('Novel不支持移动内容操作')
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }

  /// 清空章节内容（仅Comic支持）
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param id - 章节ID
  async clearContent(type: ContentType, id: number) {
    switch (type) {
      case ContentType.COMIC:
        return this.comicContentService.clearChapterContents(id)
      case ContentType.NOVEL:
        throw new BadRequestException('Novel不支持清空内容操作')
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }
}
