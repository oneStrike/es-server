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
import { ContentTypeEnum } from '@libs/base/constant'

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
  async getContent(type: ContentTypeEnum, chapterId: number) {
    switch (type) {
      case ContentTypeEnum.COMIC:
        return this.comicContentService.getChapterContents(chapterId)
      case ContentTypeEnum.NOVEL:
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
    type: ContentTypeEnum,
    req: FastifyRequest,
    query: UploadContentDto,
  ) {
    switch (type) {
      case ContentTypeEnum.COMIC:
        return this.comicContentService.addChapterContent(req, query)
      case ContentTypeEnum.NOVEL:
        return this.novelContentService.uploadChapterContent(req, query)
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }

  /// 更新章节内容（仅Comic支持）
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param body - 更新内容参数
  async updateContent(type: ContentTypeEnum, body: UpdateComicContentDto) {
    switch (type) {
      case ContentTypeEnum.COMIC:
        return this.comicContentService.updateChapterContent(body)
      case ContentTypeEnum.NOVEL:
        throw new BadRequestException('Novel不支持更新内容操作')
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }

  /// 删除章节内容
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param dto - 删除参数
  async deleteContent(type: ContentTypeEnum, dto: DeleteComicContentDto | IdDto) {
    switch (type) {
      case ContentTypeEnum.COMIC:
        return this.comicContentService.deleteChapterContent(
          dto as DeleteComicContentDto,
        )
      case ContentTypeEnum.NOVEL:
        return this.novelContentService.deleteChapterContent((dto as IdDto).id)
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }

  /// 移动章节内容（仅Comic支持）
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param body - 移动参数
  async moveContent(type: ContentTypeEnum, body: MoveComicContentDto) {
    switch (type) {
      case ContentTypeEnum.COMIC:
        return this.comicContentService.moveChapterContent(body)
      case ContentTypeEnum.NOVEL:
        throw new BadRequestException('Novel不支持移动内容操作')
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }

  /// 清空章节内容（仅Comic支持）
  /// @param type - 内容类型：'comic' 或 'novel'
  /// @param id - 章节ID
  async clearContent(type: ContentTypeEnum, id: number) {
    switch (type) {
      case ContentTypeEnum.COMIC:
        return this.comicContentService.clearChapterContents(id)
      case ContentTypeEnum.NOVEL:
        throw new BadRequestException('Novel不支持清空内容操作')
      default:
        throw new BadRequestException(`不支持的内容类型: ${type}`)
    }
  }
}
