import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  AddPointsDto,
  BasePointRuleDto,
  ConsumePointsDto,
  CreatePointRuleDto,
  PointService,
  QueryPointRecordDto,
  QueryPointRuleDto,
  UpdatePointRuleDto,
} from '@libs/forum'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/points')
@ApiTags('论坛模块/积分管理')
export class PointController {
  constructor(private readonly pointService: PointService) {}

  @Get('rules-page')
  @ApiPageDoc({
    summary: '获取积分规则分页',
    model: BasePointRuleDto,
  })
  async getPointRules(@Query() query: QueryPointRuleDto) {
    return this.pointService.getPointRulePage(query)
  }

  @Get('rules-detail')
  @ApiDoc({
    summary: '获取积分规则详情',
    model: BasePointRuleDto,
  })
  async getPointRule(@Query() dto: IdDto) {
    return this.pointService.getPointRuleDetail(dto.id)
  }

  @Post('rules-create')
  @ApiDoc({
    summary: '创建积分规则',
    model: BasePointRuleDto,
  })
  async createPointRule(@Body() dto: CreatePointRuleDto) {
    return this.pointService.createPointRule(dto)
  }

  @Post('rules-update')
  @ApiDoc({
    summary: '更新积分规则',
    model: BasePointRuleDto,
  })
  async updatePointRule(@Body() dto: UpdatePointRuleDto) {
    return this.pointService.updatePointRule(dto)
  }

  @Post('add-points')
  @ApiDoc({
    summary: '增加积分',
    model: BasePointRuleDto,
  })
  async addPoints(@Body() dto: AddPointsDto) {
    return this.pointService.addPoints(dto)
  }

  @Post('consume-points')
  @ApiDoc({
    summary: '消费积分',
    model: BasePointRuleDto,
  })
  async consumePoints(@Body() dto: ConsumePointsDto) {
    return this.pointService.consumePoints(dto)
  }

  @Get('records-page')
  @ApiPageDoc({
    summary: '获取积分记录分页',
    model: BasePointRuleDto,
  })
  async getPointRecords(@Query() query: QueryPointRecordDto) {
    return this.pointService.getPointRecordPage(query)
  }

  @Get('records-detail')
  @ApiDoc({
    summary: '获取积分记录详情',
    model: BasePointRuleDto,
  })
  async getPointRecord(@Query() dto: IdDto) {
    return this.pointService.getPointRecordDetail(dto.id)
  }

  @Get('user-stats')
  @ApiDoc({
    summary: '获取用户积分统计',
    model: BasePointRuleDto,
  })
  async getUserPointStats(@Query('userId') userId: number) {
    return this.pointService.getUserPointStats(userId)
  }

  @Post('sync-comic')
  @ApiDoc({
    summary: '与漫画系统互通',
    model: BasePointRuleDto,
  })
  async syncWithComicSystem(
    @Body('userId') userId: number,
    @Body('points') points: number,
    @Body('operation') operation: 'add' | 'consume',
  ) {
    return this.pointService.syncWithComicSystem(userId, points, operation)
  }
}
