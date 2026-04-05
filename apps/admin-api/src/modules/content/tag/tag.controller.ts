import {
  BaseTagDto,
  CreateTagDto,
  QueryTagDto,
  UpdateTagDto,
  UpdateTagSortDto,
  WorkTagService,
} from '@libs/content/tag'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

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
  @ApiDoc({
    summary: '创建标签',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '创建标签',
  })
  async create(@Body() body: CreateTagDto) {
    return this.tagService.createTag(body)
  }

  /**
   * 分页查询标签列表
   */
  @Get('page')
  @ApiPageDoc({
    summary: '分页查询标签列表',
    model: BaseTagDto,
  })
  async getPage(@Query() query: QueryTagDto) {
    return this.tagService.getTagPage(query)
  }

  /**
   * 获取标签详情
   */
  @Get('detail')
  @ApiDoc({
    summary: '获取标签详情',
    model: BaseTagDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.tagService.getTagDetail(query)
  }

  /**
   * 更新标签信息
   */
  @Post('update')
  @ApiDoc({
    summary: '更新标签信息',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新标签信息',
  })
  async update(@Body() body: UpdateTagDto) {
    return this.tagService.updateTag(body)
  }

  /**
   * 批量更新标签状态
   */
  @Post('update-status')
  @ApiDoc({
    summary: '更新标签状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新标签状态',
  })
  async updateStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.tagService.updateTagStatus(body)
  }

  /**
   * 批量删除标签
   */
  @Post('delete')
  @ApiDoc({
    summary: '删除标签',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除标签',
  })
  async deleteBatch(@Body() body: IdDto) {
    return this.tagService.deleteTagBatch(body)
  }

  /**
   * 标签拖拽排序
   */
  @Post('swap-sort-order')
  @ApiDoc({
    summary: '标签交换排序',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '标签交换排序',
  })
  async tagOrder(@Body() body: UpdateTagSortDto) {
    return this.tagService.updateTagSort(body)
  }
}
