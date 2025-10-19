import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@/common/decorators/api-doc.decorator'
import { IdDto } from '@/common/dto/id.dto'
import { ContentTypeService } from './content-type.service'
import {
  BaseContentTypeDto,
  CreateContentTypeDto,
  QueryContentTypeDto,
  UpdateContentTypeDto,
} from './dto/content-type.dto'

/**
 * 内容类型管理
 */
@ApiTags('内容类型管理模块')
@Controller('admin/work/content-type')
export class ContentTypeController {
  constructor(private readonly contentTypeService: ContentTypeService) {}

  /**
   * 创建
   */
  @Post('/create-content-type')
  @ApiDoc({ summary: '创建内容类型', model: IdDto })
  async create(@Body() body: CreateContentTypeDto) {
    const created = await this.contentTypeService.createContentType(body)
    return { id: created.id }
  }

  /**
   * 列表
   */
  @Get('/content-type-list')
  @ApiDoc({ summary: '内容类型列表', model: BaseContentTypeDto, isArray: true })
  async getPage(@Query() query?: QueryContentTypeDto) {
    return this.contentTypeService.getContentTypeList(query)
  }

  /**
   * 更新
   */
  @Post('/update-content-type')
  @ApiDoc({ summary: '更新内容类型', model: IdDto })
  async update(@Body() body: UpdateContentTypeDto) {
    await this.contentTypeService.updateContentType(body)
    return { id: body.id }
  }
}
