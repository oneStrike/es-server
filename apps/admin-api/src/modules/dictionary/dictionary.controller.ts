import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import {
  BatchEnabledDto,
  BatchOperationResponseDto,
  DragReorderDto,
  IdDto,
  IdsDto,
} from '@libs/base/dto'
import {
  BaseDictionaryDto,
  BaseDictionaryItemDto,
  CreateDictionaryDto,
  CreateDictionaryItemDto,
  DictionaryService,
  QueryDictionaryDto,
  QueryDictionaryItemDto,
  UpdateDictionaryDto,
  UpdateDictionaryItemDto,
} from '@libs/dictionary'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('字典管理')
@Controller('/admin/dictionary')
export class AdminDictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询字典',
    model: BaseDictionaryDto,
  })
  async getPage(@Query() query: QueryDictionaryDto) {
    return this.dictionaryService.findDictionaries(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取字典详情',
    model: BaseDictionaryDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.dictionaryService.dictionary.findUnique({ where: query })
  }

  @Post('create')
  @ApiDoc({
    summary: '创建字典',
    model: IdDto,
  })
  async create(@Body() createDictionaryDto: CreateDictionaryDto) {
    return this.dictionaryService.dictionary.create({
      data: createDictionaryDto,
    })
  }

  @Post('update')
  @ApiDoc({
    summary: '更新字典',
    model: IdDto,
  })
  async update(@Body() updateDictionaryDto: UpdateDictionaryDto) {
    return this.dictionaryService.dictionary.update({
      where: updateDictionaryDto,
      data: updateDictionaryDto,
    })
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除字典',
    model: IdsDto,
  })
  async delete(@Body() query: IdsDto) {
    return this.dictionaryService.dictionary.deleteMany({
      where: { id: { in: query.ids } },
    })
  }

  @Post('batch-update-status')
  @ApiDoc({
    summary: '批量启用禁用字典',
    model: BatchOperationResponseDto,
  })
  async enable(@Body() query: BatchEnabledDto) {
    return this.dictionaryService.dictionary.updateMany({
      where: { id: { in: query.ids } },
      data: { isEnabled: query.isEnabled },
    })
  }

  @Get('items')
  @ApiPageDoc({
    summary: '获取字典项',
    model: BaseDictionaryItemDto,
  })
  async getItems(@Query() query: QueryDictionaryItemDto) {
    return this.dictionaryService.findDictionaryItems(query)
  }

  @Post('create-item')
  @ApiDoc({
    summary: '创建字典项',
    model: IdDto,
  })
  async createItem(@Body() createDictionaryItemDto: CreateDictionaryItemDto) {
    return this.dictionaryService.createDictionaryItem(createDictionaryItemDto)
  }

  @Post('update-item')
  @ApiDoc({
    summary: '更新字典项',
    model: IdDto,
  })
  async updateItem(@Body() updateDictionaryItemDto: UpdateDictionaryItemDto) {
    return this.dictionaryService.updateDictionaryItem({
      ids: [updateDictionaryItemDto.id],
      ...updateDictionaryItemDto,
    })
  }

  @Post('delete-item')
  @ApiDoc({
    summary: '删除字典项',
    model: BatchOperationResponseDto,
  })
  async deleteItem(@Body() query: IdsDto) {
    return this.dictionaryService.deleteDictionaryItem(query.ids)
  }

  @Post('update-item-status')
  @ApiDoc({
    summary: '启用禁用字典项',
    model: BatchOperationResponseDto,
  })
  async enableItem(@Body() query: BatchEnabledDto) {
    return this.dictionaryService.updateDictionaryItem(query)
  }

  /**
   * 拖拽排序
   */
  @Post('/item-order')
  @ApiDoc({
    summary: '分类拖拽排序',
    model: DragReorderDto,
  })
  async categoryOrder(@Body() body: DragReorderDto) {
    return this.dictionaryService.updateDictionaryItemSort(body)
  }
}
