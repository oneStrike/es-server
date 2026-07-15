import {
  AdminTagDto,
  CreateTagDto,
  QueryTagDto,
  UpdateTagDto,
  UpdateTagSortDto,
} from '@libs/content/tag/dto/tag.dto'
import { WorkTagService } from '@libs/content/tag/tag.service'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

/**
 * 标签管理控制器
 * 提供标签相关的 RESTful API 接口
 */
@ApiTags('内容管理/标签管理')
@Controller('admin/content/tag')
export class ContentTagController {
  constructor(private readonly tagService: WorkTagService) {}

  /**
   * 创建标签
   */
  @Post('create')
  @AdminPermission({
    code: 'content:tag:create',
    name: '创建标签',
    groupCode: 'content:tag',
  })
  @ApiAuditDoc({
    summary: '创建标签',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() body: CreateTagDto) {
    return this.tagService.createTag(body)
  }

  /**
   * 分页查询标签列表
   */
  @Get('page')
  @AdminPermission({
    code: 'content:tag:page',
    name: '分页查询标签列表',
    groupCode: 'content:tag',
  })
  @ApiPageDoc({
    summary: '分页查询标签列表',
    model: AdminTagDto,
  })
  async getPage(@Query() query: QueryTagDto) {
    return this.tagService.getAdminTagPage(query)
  }

  /**
   * 获取标签详情
   */
  @Get('detail')
  @AdminPermission({
    code: 'content:tag:detail',
    name: '获取标签详情',
    groupCode: 'content:tag',
  })
  @ApiDoc({
    summary: '获取标签详情',
    model: AdminTagDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.tagService.getAdminTagDetail(query)
  }

  /**
   * 更新标签信息
   */
  @Post('update')
  @AdminPermission({
    code: 'content:tag:update',
    name: '更新标签信息',
    groupCode: 'content:tag',
  })
  @ApiAuditDoc({
    summary: '更新标签信息',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateTagDto) {
    return this.tagService.updateTag(body)
  }

  /**
   * 批量更新标签状态
   */
  @Post('update-status')
  @AdminPermission({
    code: 'content:tag:update:status',
    name: '更新标签状态',
    groupCode: 'content:tag',
  })
  @ApiAuditDoc({
    summary: '更新标签状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.tagService.updateTagStatus(body)
  }

  /**
   * 批量删除标签
   */
  @Post('delete')
  @AdminPermission({
    code: 'content:tag:delete',
    name: '删除标签',
    groupCode: 'content:tag',
  })
  @ApiAuditDoc({
    summary: '删除标签',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteBatch(@Body() body: IdDto) {
    return this.tagService.deleteTagBatch(body)
  }

  /**
   * 标签拖拽排序
   */
  @Post('swap-sort-order')
  @AdminPermission({
    code: 'content:tag:swap:sort:order',
    name: '标签交换排序',
    groupCode: 'content:tag',
  })
  @ApiAuditDoc({
    summary: '标签交换排序',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async tagOrder(@Body() body: UpdateTagSortDto) {
    return this.tagService.updateTagSort(body)
  }
}
