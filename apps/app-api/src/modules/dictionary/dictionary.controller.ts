import { ApiPageDoc, Public } from '@libs/base/decorators'

import { BaseDictionaryItemDto, LibDictionaryService } from '@libs/dictionary'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { QueryDictionaryItemDto } from './dto/dictionary.dto'

@ApiTags('字典管理')
@Controller('app/dictionary')
export class DictionaryController {
  constructor(private readonly libDictionaryService: LibDictionaryService) {}

  @Get('items')
  @ApiPageDoc({
    summary: '获取数据字典',
    model: BaseDictionaryItemDto,
  })
  @Public()
  async getItems(@Query() query: QueryDictionaryItemDto) {
    return this.libDictionaryService.findDictionaryItems(query)
  }
}
