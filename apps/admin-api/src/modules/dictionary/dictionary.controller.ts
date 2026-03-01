import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import {
  BatchOperationResponseDto,
  DragReorderDto,
  IdDto,
  UpdateEnabledStatusDto,
} from '@libs/base/dto'
import {
  BaseDictionaryDto,
  BaseDictionaryItemDto,
  CreateDictionaryDto,
  CreateDictionaryItemDto,
  LibDictionaryService,
  QueryAllDictionaryItemDto,
  QueryDictionaryDto,
  QueryDictionaryItemDto,
  UpdateDictionaryDto,
  UpdateDictionaryItemDto,
} from '@libs/dictionary'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('字典管理')
@Controller('/admin/dictionary')
export class DictionaryController {
  constructor(private readonly libDictionaryService: LibDictionaryService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询字典',
    model: BaseDictionaryDto,
  })
  async getPage(@Query() query: QueryDictionaryDto) {
    return this.libDictionaryService.findDictionaries(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取字典详情',
    model: BaseDictionaryDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.libDictionaryService.dictionary.findUnique({ where: query })
  }

  @Post('create')
  @ApiDoc({
    summary: '创建字典',
    model: IdDto,
  })
  async create(@Body() createDictionaryDto: CreateDictionaryDto) {
    return this.libDictionaryService.createDictionary(createDictionaryDto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新字典',
    model: IdDto,
  })
  async update(@Body() updateDictionaryDto: UpdateDictionaryDto) {
    return this.libDictionaryService.updateDictionary(updateDictionaryDto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除字典',
    model: IdDto,
  })
  async delete(@Body() query: IdDto) {
    return this.libDictionaryService.deleteDictionary(query.id)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新字典状态',
    model: IdDto,
  })
  async updateStatus(@Body() query: UpdateEnabledStatusDto) {
    return this.libDictionaryService.updateDictionaryStatus(query)
  }

  @Get('items')
  @ApiPageDoc({
    summary: '分页获取字典项',
    model: BaseDictionaryItemDto,
  })
  async getItems(@Query() query: QueryDictionaryItemDto) {
    return this.libDictionaryService.findDictionaryItems(query)
  }

  @Get('all-items')
  @ApiDoc({
    summary: '获取所有字典项',
    model: BaseDictionaryItemDto,
  })
  async getAllItems(@Query() query: QueryAllDictionaryItemDto) {
    return this.libDictionaryService.findAllDictionaryItems(
      query.dictionaryCode,
    )
  }

  @Post('create-item')
  @ApiDoc({
    summary: '创建字典项',
    model: IdDto,
  })
  async createItem(@Body() createDictionaryItemDto: CreateDictionaryItemDto) {
    return this.libDictionaryService.createDictionaryItem(
      createDictionaryItemDto,
    )
  }

  @Post('update-item')
  @ApiDoc({
    summary: '更新字典项',
    model: IdDto,
  })
  async updateItem(@Body() updateDictionaryItemDto: UpdateDictionaryItemDto) {
    return this.libDictionaryService.updateDictionaryItem(
      updateDictionaryItemDto,
    )
  }

  @Post('update-item-status')
  @ApiDoc({
    summary: '启用禁用字典项',
    model: BatchOperationResponseDto,
  })
  async enableItem(@Body() query: UpdateEnabledStatusDto) {
    return this.libDictionaryService.updateDictionaryItemStatus(query)
  }

  @Post('delete-item')
  @ApiDoc({
    summary: '删除字典项',
    model: IdDto,
  })
  async deleteItem(@Body() query: IdDto) {
    return this.libDictionaryService.deleteDictionaryItem(query.id)
  }

  /**
   * 拖拽排序
   */
  @Post('/item-order')
  @ApiDoc({
    summary: '字典项拖拽排序',
    model: DragReorderDto,
  })
  async itemOrder(@Body() body: DragReorderDto) {
    return this.libDictionaryService.updateDictionaryItemSort(body)
  }
}
