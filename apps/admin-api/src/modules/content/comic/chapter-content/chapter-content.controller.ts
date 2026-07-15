import type { FastifyRequest } from 'fastify'
import { ComicArchiveImportService } from '@libs/content/work/content/comic-archive-import.service'
import { ComicContentService } from '@libs/content/work/content/comic-content.service'
import {
  ComicArchiveTaskResponseDto,
  ComicArchiveWorkflowJobIdDto,
  ConfirmComicArchiveDto,
  CreateComicArchiveSessionDto,
  DeleteComicContentDto,
  MoveComicContentDto,
  PreviewComicArchiveDto,
  UpdateComicContentDto,
  UploadContentDto,
} from '@libs/content/work/content/dto/content.dto'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { UploadResponseDto } from '@libs/platform/modules/upload/dto'
import {
  WorkflowJobDto,
  WorkflowJobIdDto,
} from '@libs/workflow/workflow/dto/workflow.dto'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../../common/decorators/api-audit-doc.decorator'

@ApiTags('内容管理/漫画管理/章节内容')
@Controller('admin/content/comic/chapter-content')
export class ChapterContentController {
  constructor(
    private readonly comicContentService: ComicContentService,
    private readonly comicArchiveImportService: ComicArchiveImportService,
  ) {}

  @Get('list')
  @AdminPermission({
    code: 'content:comic:chapter:content:list',
    name: '获取章节内容',
    groupCode: 'content:comic:chapter:content',
  })
  @ApiDoc({
    summary: '获取章节内容',
    model: String,
    isArray: true,
  })
  async getContents(@Query() query: IdDto) {
    return this.comicContentService.getChapterContents(query.id)
  }

  @Post('upload')
  @AdminPermission({
    code: 'content:comic:chapter:content:upload',
    name: '上传章节内容',
    groupCode: 'content:comic:chapter:content',
  })
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
  @AdminPermission({
    code: 'content:comic:chapter:content:update',
    name: '更新章节内容',
    groupCode: 'content:comic:chapter:content',
  })
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
  @AdminPermission({
    code: 'content:comic:chapter:content:delete',
    name: '删除章节内容',
    groupCode: 'content:comic:chapter:content',
  })
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
  @AdminPermission({
    code: 'content:comic:chapter:content:move',
    name: '移动章节内容',
    groupCode: 'content:comic:chapter:content',
  })
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
  @AdminPermission({
    code: 'content:comic:chapter:content:clear',
    name: '清空章节内容',
    groupCode: 'content:comic:chapter:content',
  })
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
  @AdminPermission({
    code: 'content:comic:chapter:content:archive:preview',
    name: '预解析漫画压缩包',
    groupCode: 'content:comic:chapter:content',
  })
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

  @Post('archive/session')
  @AdminPermission({
    code: 'content:comic:chapter:content:archive:session',
    name: '创建漫画压缩包预解析会话',
    groupCode: 'content:comic:chapter:content',
  })
  @ApiAuditDoc({
    summary: '创建漫画压缩包预解析会话',
    model: WorkflowJobIdDto,
    audit: {
      actionType: AuditActionTypeEnum.IMPORT,
    },
  })
  async archiveSession(
    @Body() body: CreateComicArchiveSessionDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.comicArchiveImportService.createPreviewSession(body, userId)
  }

  @Post('archive/discard')
  @AdminPermission({
    code: 'content:comic:chapter:content:archive:discard',
    name: '丢弃漫画压缩包预解析会话',
    groupCode: 'content:comic:chapter:content',
  })
  @ApiAuditDoc({
    summary: '丢弃漫画压缩包预解析会话',
    model: WorkflowJobDto,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async archiveDiscard(@Body() body: ComicArchiveWorkflowJobIdDto) {
    return this.comicArchiveImportService.discardArchivePreview(body)
  }

  @Post('archive/confirm')
  @AdminPermission({
    code: 'content:comic:chapter:content:archive:confirm',
    name: '确认漫画压缩包导入',
    groupCode: 'content:comic:chapter:content',
  })
  @ApiAuditDoc({
    summary: '确认漫画压缩包导入',
    model: WorkflowJobDto,
    audit: {
      actionType: AuditActionTypeEnum.IMPORT,
    },
  })
  async archiveConfirm(@Body() body: ConfirmComicArchiveDto) {
    return this.comicArchiveImportService.confirmArchive(body)
  }

  @Get('archive/detail')
  @AdminPermission({
    code: 'content:comic:chapter:content:archive:detail',
    name: '查询漫画压缩包导入任务详情',
    groupCode: 'content:comic:chapter:content',
  })
  @ApiDoc({
    summary: '查询漫画压缩包导入任务详情',
    model: ComicArchiveTaskResponseDto,
  })
  async archiveDetail(@Query() query: WorkflowJobIdDto) {
    return this.comicArchiveImportService.getArchiveDetail(query)
  }
}
