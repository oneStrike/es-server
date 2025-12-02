import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import {
  BatchEnabledDto,
  BatchOperationResponseDto,
  DragReorderDto,
  IdDto,
  IdsDto,
} from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  BaseTagDto,
  CreateTagDto,
  QueryTagDto,
  UpdateTagDto,
} from './dto/tag.dto'
import { WorkTagService } from './tag.service'

/**
 * 标签管理控制器
 * 提供标签相关的 RESTful API 接口
 */
@ApiTags('标签管理模块')
@Controller('admin/work/tag')
export class WorkTagController {
  constructor(private readonly tagService: WorkTagService) {}

  /**
   * 创建标签
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建标签',
    model: IdDto,
  })
  async create(@Body() body: CreateTagDto) {
    return this.tagService.createTag(body)
  }

  /**
   * 分页查询标签列表
   */
  @Get('/page')
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
  @Get('/detail')
  @ApiDoc({
    summary: '获取标签详情',
    model: BaseTagDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.tagService.getTagDetail(query.id)
  }

  /**
   * 更新标签信息
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新标签信息',
    model: IdDto,
  })
  async update(@Body() body: UpdateTagDto) {
    return this.tagService.updateTag(body)
  }

  /**
   * 批量更新标签状态
   */
  @Post('/batch-update-status')
  @ApiDoc({
    summary: '批量更新标签状态',
    model: BatchOperationResponseDto,
  })
  async updateStatus(@Body() body: BatchEnabledDto) {
    return this.tagService.updateTagStatus(body)
  }

  /**
   * 批量删除标签
   */
  @Post('/batch-delete')
  @ApiDoc({
    summary: '批量删除标签',
    model: BatchOperationResponseDto,
  })
  async deleteBatch(@Body() body: IdsDto) {
    return this.tagService.deleteTagBatch(body.ids)
  }

  /**
   * 标签拖拽排序
   */
  @Post('/order')
  @ApiDoc({
    summary: '标签拖拽排序',
    model: DragReorderDto,
  })
  async tagOrder(@Body() body: DragReorderDto) {
    return this.tagService.updateTagSort(body)
  }
}
