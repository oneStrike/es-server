import type { FastifyRequest } from 'fastify'
import { ComicArchiveImportService } from '@libs/content/work/content/comic-archive-import.service';
import { ComicContentService } from '@libs/content/work/content/comic-content.service';
import { ComicArchiveTaskIdDto, ComicArchiveTaskResponseDto, ConfirmComicArchiveDto, DeleteComicContentDto, MoveComicContentDto, PreviewComicArchiveDto, UpdateComicContentDto, UploadContentDto } from '@libs/content/work/content/dto/content.dto';
import { ApiDoc } from '@libs/platform/decorators';
import { IdDto } from '@libs/platform/dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { UploadResponseDto } from '@libs/platform/modules/upload/dto'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../../common/decorators/api-audit-doc.decorator'

@ApiTags('内容管理/漫画管理/章节内容')
@Controller('admin/content/comic/chapter-content')
export class ChapterContentController {
  constructor(
    private readonly comicContentService: ComicContentService,
    private readonly comicArchiveImportService: ComicArchiveImportService,
  ) {}

  @Get('list')
  @ApiDoc({
    summary: '获取章节内容',
    model: String,
    isArray: true,
  })
  async getContents(@Query() query: IdDto) {
    return this.comicContentService.getChapterContents(query.id)
  }

  @Post('upload')
  @ApiAuditDoc({
    summary: '上传章节内容',
    model: UploadResponseDto,
    audit: {
      actionType: AuditActionTypeEnum.UPLOAD,
    },
  })
  async upload(@Req() req: FastifyRequest, @Query() query: UploadContentDto) {
    return this.comicContentService.addChapterContent(req, query)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新章节内容',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateComicContentDto) {
    return this.comicContentService.updateChapterContent(body)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除章节内容',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: DeleteComicContentDto) {
    return this.comicContentService.deleteChapterContent(body)
  }

  @Post('move')
  @ApiAuditDoc({
    summary: '移动章节内容',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async move(@Body() body: MoveComicContentDto) {
    return this.comicContentService.moveChapterContent(body)
  }

  @Post('clear')
  @ApiAuditDoc({
    summary: '清空章节内容',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async clear(@Body() body: IdDto) {
    return this.comicContentService.clearChapterContents(body.id)
  }

  @Post('archive/preview')
  @ApiAuditDoc({
    summary: '预解析漫画压缩包',
    model: ComicArchiveTaskResponseDto,
    audit: {
      actionType: AuditActionTypeEnum.IMPORT,
    },
  })
  async archivePreview(
    @Req() req: FastifyRequest,
    @Query() query: PreviewComicArchiveDto,
  ) {
    return this.comicArchiveImportService.previewArchive(req, query)
  }

  @Post('archive/confirm')
  @ApiAuditDoc({
    summary: '确认漫画压缩包导入',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.IMPORT,
    },
  })
  async archiveConfirm(@Body() body: ConfirmComicArchiveDto) {
    return this.comicArchiveImportService.confirmArchive(body)
  }

  @Get('archive/detail')
  @ApiDoc({
    summary: '查询漫画压缩包导入任务详情',
    model: ComicArchiveTaskResponseDto,
  })
  async archiveDetail(@Query() query: ComicArchiveTaskIdDto) {
    return this.comicArchiveImportService.getArchiveDetail(query)
  }
}
