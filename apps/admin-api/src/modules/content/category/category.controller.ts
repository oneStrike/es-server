import {
  BaseCategoryDto,
  WorkCategoryService,
} from '@libs/content'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  CreateCategoryDto,
  QueryCategoryDto,
  UpdateCategoryDto,
  UpdateCategorySortDto,
  UpdateCategoryStatusDto,
} from './dto/category.dto'

/**
 * 分类管理控制器
 * 提供分类相关的 RESTful API 接口
 */
@ApiTags('内容管理/分类管理')
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
    return this.categoryService.getCategoryDetail(query)
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
   * 更新分类状态
   */
  @Post('/update-status')
  @ApiDoc({
    summary: '更新分类状态',
    model: IdDto,
  })
  async updateStatus(@Body() body: UpdateCategoryStatusDto) {
    return this.categoryService.updateCategoryStatus(body)
  }

  /**
   * 批量删除分类
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除分类',
    model: IdDto,
  })
  async deleteBatch(@Body() body: IdDto) {
    return this.categoryService.deleteCategory(body)
  }

  /**
   * 拖拽排序
   */
  @Post('/order')
  @ApiDoc({
    summary: '分类拖拽排序',
    model: UpdateCategorySortDto,
  })
  async categoryOrder(@Body() body: UpdateCategorySortDto) {
    return this.categoryService.updateCategorySort(body)
  }
}
