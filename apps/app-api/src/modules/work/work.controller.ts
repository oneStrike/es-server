import {
  WorkService,
} from '@libs/content'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
  OptionalAuth,
  Public,
  RequestMeta,
  RequestMetaResult,
} from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Controller, Get, Headers, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  PageWorkDto,
  QueryWorkDto,
  QueryWorkTypeDto,
  WorkDetailDto,
  WorkForumSectionDto,
} from './dto/work.dto'

@ApiTags('作品')
@Controller('app/work')
export class WorkController {
  constructor(private readonly workService: WorkService) {}

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
    return this.workService.getWorkPage({
      ...query,
      isPublished: true,
    })
  }

  @Get('detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询作品详情',
    model: WorkDetailDto,
  })
  async getWorkDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
    @RequestMeta() meta: RequestMetaResult,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.workService.getWorkDetail(query.id, {
      userId,
      ipAddress: meta.ip,
      device: meta.deviceId,
      userAgent,
    })
  }

  @Get('forum-section/detail')
  @Public()
  @ApiDoc({
    summary: '查询作品关联板块详情',
    model: WorkForumSectionDto,
  })
  async getWorkForumSection(@Query() query: IdDto) {
    return this.workService.getWorkForumSection(query.id)
  }
}
