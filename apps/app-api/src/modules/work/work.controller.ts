import { ApiPageDoc, Public } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseWorkDto,
  PageWorkDto,
  QueryWorkDto,
  QueryWorkTypeDto,
  WorkChapterService,
  WorkService,
} from '@libs/content'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('作品模块')
@Controller('app/work')
export class WorkController {
  constructor(
    private readonly workService: WorkService,
    private readonly workChapterService: WorkChapterService,
  ) {}

  @Get('hot/page')
  @Public()
  @ApiPageDoc({
    summary: '分页查询热门作品',
    model: PageWorkDto,
  })
  async getAvailable(@Query() query: QueryWorkTypeDto) {
    return this.workService.getHotWorkPage(query)
  }

  @Get('new/page')
  @Public()
  @ApiPageDoc({
    summary: '分页查询最新作品',
    model: PageWorkDto,
  })
  async getNewWorkPage(@Query() query: QueryWorkTypeDto) {
    return this.workService.getNewWorkPage(query)
  }

  @Get('recommended/page')
  @Public()
  @ApiPageDoc({
    summary: '分页查询推荐作品',
    model: PageWorkDto,
  })
  async getRecommendedWorkPage(@Query() query: QueryWorkTypeDto) {
    return this.workService.getRecommendedWorkPage(query)
  }

  @Get('page')
  @Public()
  @ApiPageDoc({
    summary: '分页查询作品列表',
    model: PageWorkDto,
  })
  async getWorkPage(@Query() query: QueryWorkDto) {
    return this.workService.getWorkPage(query)
  }

  @Get('detail')
  @Public()
  @ApiPageDoc({
    summary: '查询作品详情',
    model: BaseWorkDto,
  })
  async getWorkDetail(@Query() query: IdDto) {
    return this.workService.getWorkDetail(query.id)
  }
}
