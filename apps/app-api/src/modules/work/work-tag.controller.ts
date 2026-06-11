import { QueryAppTagCursorDto, TagOutputDto } from '@libs/content/tag/dto/tag.dto'
import { WorkTagService } from '@libs/content/tag/tag.service'
import { ApiCursorPageDoc, OptionalAuth } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('作品')
@Controller('app/work/tag')
export class WorkTagController {
  constructor(private readonly tagService: WorkTagService) {}

  @Get('page')
  @OptionalAuth()
  @ApiCursorPageDoc({
    summary: '分页查询作品标签列表',
    model: TagOutputDto,
  })
  async getTagPage(@Query() query: QueryAppTagCursorDto) {
    return this.tagService.getAppTagCursorPage(query)
  }
}
