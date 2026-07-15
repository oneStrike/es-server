import {
  AdminWorkChapterDetailDto,
  AdminWorkChapterPageItemDto,
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from '@libs/content/work/chapter/dto/work-chapter.dto'
import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { WorkTypeEnum } from '@libs/platform/constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'

import {
  BatchUpdatePublishedStatusDto,
  DragReorderDto,
  IdDto,
  IdsDto,
} from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../../common/decorators/api-audit-doc.decorator'
import { Audit } from '../../../../common/decorators/audit.decorator'

@ApiTags('内容管理/漫画管理/章节管理')
@Controller('admin/content/comic/chapter')
export class ComicChapterController {
  constructor(private readonly workChapterService: WorkChapterService) {}

  @Post('create')
  @AdminPermission({
    code: 'content:comic:chapter:create',
    name: '创建漫画章节',
    groupCode: 'content:comic:chapter',
  })
  @ApiAuditDoc({
    summary: '创建漫画章节',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() body: CreateWorkChapterDto) {
    return this.workChapterService.createChapter(
      {
        ...body,
        workType: WorkTypeEnum.COMIC,
      },
      WorkTypeEnum.COMIC,
    )
  }

  @Get('page')
  @AdminPermission({
    code: 'content:comic:chapter:page',
    name: '分页查询漫画章节列表',
    groupCode: 'content:comic:chapter',
  })
  @ApiPageDoc({
    summary: '分页查询漫画章节列表',
    model: AdminWorkChapterPageItemDto,
  })
  async getPage(@Query() query: QueryWorkChapterDto) {
    return this.workChapterService.getAdminChapterPage(
      query,
      WorkTypeEnum.COMIC,
    )
  }

  @Get('detail')
  @AdminPermission({
    code: 'content:comic:chapter:detail',
    name: '获取漫画章节详情',
    groupCode: 'content:comic:chapter',
  })
  @ApiDoc({
    summary: '获取漫画章节详情',
    model: AdminWorkChapterDetailDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workChapterService.getChapterDetail(query.id, {
      bypassVisibilityCheck: true,
      expectedType: WorkTypeEnum.COMIC,
    })
  }

  @Post('update')
  @AdminPermission({
    code: 'content:comic:chapter:update',
    name: '更新漫画章节',
    groupCode: 'content:comic:chapter',
  })
  @ApiAuditDoc({
    summary: '更新漫画章节',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateWorkChapterDto) {
    return this.workChapterService.updateChapter(body, WorkTypeEnum.COMIC)
  }

  @Post('delete')
  @AdminPermission({
    code: 'content:comic:chapter:delete',
    name: '删除漫画章节',
    groupCode: 'content:comic:chapter',
  })
  @ApiAuditDoc({
    summary: '删除漫画章节',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: IdDto) {
    return this.workChapterService.deleteChapter(body.id, WorkTypeEnum.COMIC)
  }

  @Post('batch-delete')
  @AdminPermission({
    code: 'content:comic:chapter:batch:delete',
    name: '批量删除漫画章节',
    groupCode: 'content:comic:chapter',
  })
  @ApiAuditDoc({
    summary: '批量删除漫画章节',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async batchDelete(@Body() body: IdsDto) {
    return this.workChapterService.deleteChapters(body.ids, WorkTypeEnum.COMIC)
  }

  @Post('batch-update-status')
  @AdminPermission({
    code: 'content:comic:chapter:batch:update:status',
    name: '批量更新漫画章节发布状态',
    groupCode: 'content:comic:chapter',
  })
  @ApiAuditDoc({
    summary: '批量更新漫画章节发布状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async batchUpdateStatus(@Body() body: BatchUpdatePublishedStatusDto) {
    return this.workChapterService.batchUpdateChapterPublishStatus(
      body,
      WorkTypeEnum.COMIC,
    )
  }

  @Post('swap-sort-order')
  @AdminPermission({
    code: 'content:comic:chapter:swap:sort:order',
    name: '交换章节序号',
    groupCode: 'content:comic:chapter',
  })
  @ApiDoc({
    summary: '交换章节序号',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '交换漫画章节序号',
  })
  async swapSortOrder(@Body() body: DragReorderDto) {
    return this.workChapterService.swapChapterNumbers(body, WorkTypeEnum.COMIC)
  }
}
