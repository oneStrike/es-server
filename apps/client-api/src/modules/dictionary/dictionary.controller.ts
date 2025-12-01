import { ApiPageDoc, Public } from '@libs/base/decorators'

import { BaseDictionaryItemDto, DictionaryService } from '@libs/dictionary'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { QueryDictionaryItemDto } from './dto/dictionary.dto'

@ApiTags('字典管理')
@Controller('/client/dictionary')
export class ClientDictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get('items')
  @ApiPageDoc({
    summary: '获取数据字典',
    model: BaseDictionaryItemDto,
  })
  @Public()
  async getItems(@Query() query: QueryDictionaryItemDto) {
    return this.dictionaryService.findDictionaryItems(query)
  }
}
