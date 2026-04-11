import { LibDictionaryService } from '@libs/dictionary/dictionary.service';
import { BaseDictionaryItemDto, QueryAllDictionaryItemDto } from '@libs/dictionary/dto/dictionary.dto';
import { ApiDoc, Public } from '@libs/platform/decorators';

import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('字典')
@Controller('app/dictionary')
export class DictionaryController {
  constructor(private readonly libDictionaryService: LibDictionaryService) {}

  @Get('item/list')
  @ApiDoc({
    summary: '获取数据字典',
    model: BaseDictionaryItemDto,
    isArray: true,
  })
  @Public()
  async getItems(@Query() query: QueryAllDictionaryItemDto) {
    return this.libDictionaryService.findAllDictionaryItems(query)
  }
}
