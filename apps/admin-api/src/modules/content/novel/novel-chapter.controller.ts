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
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('内容管理/小说管理/章节管理')
@Controller('admin/content/novel/chapter')
export class NovelChapterController {
  constructor(private readonly workChapterService: WorkChapterService) {}

  @Post('create')
  @AdminPermission({
    code: 'content:novel:chapter:create',
    name: '创建小说章节',
    groupCode: 'content:novel:chapter',
  })
  @ApiAuditDoc({
    summary: '创建小说章节',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() body: CreateWorkChapterDto) {
    return this.workChapterService.createChapter(
      {
        ...body,
        workType: WorkTypeEnum.NOVEL,
      },
      WorkTypeEnum.NOVEL,
    )
  }

  @Get('page')
  @AdminPermission({
    code: 'content:novel:chapter:page',
    name: '分页查询小说章节列表',
    groupCode: 'content:novel:chapter',
  })
  @ApiPageDoc({
    summary: '分页查询小说章节列表',
    model: AdminWorkChapterPageItemDto,
  })
  async getPage(@Query() query: QueryWorkChapterDto) {
    return this.workChapterService.getAdminChapterPage(
      query,
      WorkTypeEnum.NOVEL,
    )
  }

  @Get('detail')
  @AdminPermission({
    code: 'content:novel:chapter:detail',
    name: '获取小说章节详情',
    groupCode: 'content:novel:chapter',
  })
  @ApiDoc({
    summary: '获取小说章节详情',
    model: AdminWorkChapterDetailDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workChapterService.getChapterDetail(query.id, {
      bypassVisibilityCheck: true,
      expectedType: WorkTypeEnum.NOVEL,
    })
  }

  @Post('update')
  @AdminPermission({
    code: 'content:novel:chapter:update',
    name: '更新小说章节',
    groupCode: 'content:novel:chapter',
  })
  @ApiAuditDoc({
    summary: '更新小说章节',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateWorkChapterDto) {
    return this.workChapterService.updateChapter(body, WorkTypeEnum.NOVEL)
  }

  @Post('delete')
  @AdminPermission({
    code: 'content:novel:chapter:delete',
    name: '删除小说章节',
    groupCode: 'content:novel:chapter',
  })
  @ApiAuditDoc({
    summary: '删除小说章节',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() query: IdDto) {
    return this.workChapterService.deleteChapter(query.id, WorkTypeEnum.NOVEL)
  }

  @Post('batch-delete')
  @AdminPermission({
    code: 'content:novel:chapter:batch:delete',
    name: '批量删除小说章节',
    groupCode: 'content:novel:chapter',
  })
  @ApiAuditDoc({
    summary: '批量删除小说章节',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async batchDelete(@Body() body: IdsDto) {
    return this.workChapterService.deleteChapters(body.ids, WorkTypeEnum.NOVEL)
  }

  @Post('batch-update-status')
  @AdminPermission({
    code: 'content:novel:chapter:batch:update:status',
    name: '批量更新小说章节发布状态',
    groupCode: 'content:novel:chapter',
  })
  @ApiAuditDoc({
    summary: '批量更新小说章节发布状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async batchUpdateStatus(@Body() body: BatchUpdatePublishedStatusDto) {
    return this.workChapterService.batchUpdateChapterPublishStatus(
      body,
      WorkTypeEnum.NOVEL,
    )
  }

  @Post('swap-sort-order')
  @AdminPermission({
    code: 'content:novel:chapter:swap:sort:order',
    name: '交换章节序号',
    groupCode: 'content:novel:chapter',
  })
  @ApiAuditDoc({
    summary: '交换章节序号',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
      content: '交换小说章节序号',
    },
  })
  async swapSortOrder(@Body() body: DragReorderDto) {
    return this.workChapterService.swapChapterNumbers(body, WorkTypeEnum.NOVEL)
  }
}
