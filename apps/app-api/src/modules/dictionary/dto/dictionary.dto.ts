import { BaseDictionaryItemDto } from '@libs/dictionary'
import { PickType } from '@nestjs/swagger'

export class QueryDictionaryItemDto extends PickType(BaseDictionaryItemDto, [
  'dictionaryCode',
]) {}
