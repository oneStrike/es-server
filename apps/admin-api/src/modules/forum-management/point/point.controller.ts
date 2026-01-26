import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  AddForumPointsDto,
  BaseForumPointRuleDto,
  ConsumeForumPointsDto,
  CreateForumPointRuleDto,
  ForumPointService,
  QueryForumPointRecordDto,
  QueryForumPointRuleDto,
  UpdateForumPointRuleDto,
} from '@libs/user/point'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/points')
@ApiTags('论坛模块/积分管理')
export class PointController {
  constructor(private readonly forumPointService: ForumPointService) {}

  @Get('rules-page')
  @ApiPageDoc({
    summary: '获取积分规则分页',
    model: BaseForumPointRuleDto,
  })
  async getPointRules(@Query() query: QueryForumPointRuleDto) {
    return this.forumPointService.getPointRulePage(query)
  }

  @Get('rules-detail')
  @ApiDoc({
    summary: '获取积分规则详情',
    model: BaseForumPointRuleDto,
  })
  async getPointRule(@Query() dto: IdDto) {
    return this.forumPointService.getPointRuleDetail(dto.id)
  }

  @Post('rules-create')
  @ApiDoc({
    summary: '创建积分规则',
    model: BaseForumPointRuleDto,
  })
  async createPointRule(@Body() dto: CreateForumPointRuleDto) {
    return this.forumPointService.createPointRule(dto)
  }

  @Post('rules-update')
  @ApiDoc({
    summary: '更新积分规则',
    model: BaseForumPointRuleDto,
  })
  async updatePointRule(@Body() dto: UpdateForumPointRuleDto) {
    return this.forumPointService.updatePointRule(dto)
  }

  @Post('add-points')
  @ApiDoc({
    summary: '增加积分',
    model: BaseForumPointRuleDto,
  })
  async addPoints(@Body() dto: AddForumPointsDto) {
    return this.forumPointService.addPoints(dto)
  }

  @Post('consume-points')
  @ApiDoc({
    summary: '消费积分',
    model: BaseForumPointRuleDto,
  })
  async consumePoints(@Body() dto: ConsumeForumPointsDto) {
    return this.forumPointService.consumePoints(dto)
  }

  @Get('records-page')
  @ApiPageDoc({
    summary: '获取积分记录分页',
    model: BaseForumPointRuleDto,
  })
  async getPointRecords(@Query() query: QueryForumPointRecordDto) {
    return this.forumPointService.getPointRecordPage(query)
  }

  @Get('records-detail')
  @ApiDoc({
    summary: '获取积分记录详情',
    model: BaseForumPointRuleDto,
  })
  async getPointRecord(@Query() dto: IdDto) {
    return this.forumPointService.getPointRecordDetail(dto.id)
  }

  @Get('user-stats')
  @ApiDoc({
    summary: '获取用户积分统计',
    model: BaseForumPointRuleDto,
  })
  async getUserPointStats(@Query('userId') userId: number) {
    return this.forumPointService.getUserPointStats(userId)
  }

  @Post('sync-comic')
  @ApiDoc({
    summary: '与漫画系统互通',
    model: BaseForumPointRuleDto,
  })
  async syncWithComicSystem(
    @Body('userId') userId: number,
    @Body('points') points: number,
    @Body('operation') operation: 'add' | 'consume',
  ) {
    return this.forumPointService.syncWithComicSystem(userId, points, operation)
  }
}
