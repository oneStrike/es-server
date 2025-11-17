import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { IdDto, IdsDto } from '@/common/dto/base.dto'
import { OrderDto } from '@/common/dto/order.dto'
import { BatchEnabledDto, BatchOperationResponseDto } from '@/common/dto/status.dto'
import { ApiDoc, ApiPageDoc } from '@/decorators/api-doc.decorator'
import { WorkCategoryService } from './category.service'
import {
  BaseCategoryDto,
  CreateCategoryDto,
  QueryCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto'

/**
 * 分类管理控制器
 * 提供分类相关的 RESTful API 接口
 */
@ApiTags('分类管理模块')
@Controller('admin/work/category')
export class WorkCategoryController {
  constructor(private readonly categoryService: WorkCategoryService) {}

  /**
   * 创建分类
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建分类',
    model: IdDto,
  })
  async create(@Body() body: CreateCategoryDto) {
    return this.categoryService.createCategory(body)
  }

  /**
   * 分页查询分类列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询分类列表',
    model: BaseCategoryDto,
  })
  async getPage(@Query() query: QueryCategoryDto) {
    return this.categoryService.getCategoryPage(query)
  }

  /**
   * 获取分类详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取分类详情',
    model: BaseCategoryDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.categoryService.getCategoryDetail(query.id)
  }

  /**
   * 更新分类信息
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新分类信息',
    model: IdDto,
  })
  async update(@Body() body: UpdateCategoryDto) {
    return this.categoryService.updateCategory(body)
  }

  /**
   * 批量更新分类状态
   */
  @Post('/batch-update-status')
  @ApiDoc({
    summary: '批量更新分类状态',
    model: BatchOperationResponseDto,
  })
  async updateStatus(@Body() body: BatchEnabledDto) {
    return this.categoryService.updateCategoryStatus(body)
  }

  /**
   * 批量删除分类
   */
  @Post('/batch-delete')
  @ApiDoc({
    summary: '批量删除分类',
    model: BatchOperationResponseDto,
  })
  async deleteBatch(@Body() body: IdsDto) {
    return this.categoryService.deleteCategoryBatch(body.ids)
  }

  /**
   * 拖拽排序
   */
  @Post('/order')
  @ApiDoc({
    summary: '分类拖拽排序',
    model: OrderDto,
  })
  async categoryOrder(@Body() body: OrderDto) {
    return this.categoryService.updateCategorySort(body)
  }
}
