import { WorkCategoryService } from '@libs/content/category/category.service'
import {
  CategoryOutputDto,
  QueryAppCategoryPageDto,
} from '@libs/content/category/dto/category.dto'
import { ApiPageDoc, OptionalAuth } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('作品')
@Controller('app/work/category')
export class WorkCategoryController {
  constructor(private readonly categoryService: WorkCategoryService) {}

  @Get('page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询作品分类列表',
    model: CategoryOutputDto,
  })
  async getCategoryPage(@Query() query: QueryAppCategoryPageDto) {
    return this.categoryService.getAppCategoryPage(query)
  }
}
