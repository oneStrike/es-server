import { WorkCategoryService } from '@libs/content/category/category.service';
import { BaseCategoryDto, CreateCategoryDto, QueryCategoryDto, UpdateCategoryDto, UpdateCategorySortDto, UpdateCategoryStatusDto } from '@libs/content/category/dto/category.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuditActionTypeEnum } from '../../../common/audit/audit-action.constant'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

/**
 * 分类管理控制器
 * 提供分类相关的 RESTful API 接口
 */
@ApiTags('内容管理/分类管理')
@Controller('admin/content/category')
export class ContentCategoryController {
  constructor(private readonly categoryService: WorkCategoryService) {}

  /**
   * 创建分类
   */
  @Post('create')
  @ApiAuditDoc({
    summary: '创建分类',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() body: CreateCategoryDto) {
    return this.categoryService.createCategory(body)
  }

  /**
   * 分页查询分类列表
   */
  @Get('page')
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
  @Get('detail')
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
  @Post('update')
  @ApiAuditDoc({
    summary: '更新分类信息',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateCategoryDto) {
    return this.categoryService.updateCategory(body)
  }

  /**
   * 更新分类状态
   */
  @Post('update-status')
  @ApiAuditDoc({
    summary: '更新分类状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(@Body() body: UpdateCategoryStatusDto) {
    return this.categoryService.updateCategoryStatus(body)
  }

  /**
   * 批量删除分类
   */
  @Post('delete')
  @ApiAuditDoc({
    summary: '删除分类',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteBatch(@Body() body: IdDto) {
    return this.categoryService.deleteCategory(body)
  }

  /**
   * 拖拽排序
   */
  @Post('swap-sort-order')
  @ApiAuditDoc({
    summary: '分类交换排序',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async categoryOrder(@Body() body: UpdateCategorySortDto) {
    return this.categoryService.updateCategorySort(body)
  }
}
