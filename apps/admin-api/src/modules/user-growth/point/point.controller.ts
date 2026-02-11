import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  AddUserPointsDto,
  BaseUserPointRuleDto,
  ConsumeUserPointsDto,
  CreateUserPointRuleDto,
  QueryUserPointRecordDto,
  QueryUserPointRuleDto,
  UpdateUserPointRuleDto,
  UserPointService,
} from '@libs/user/point'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/user-growth/points-rules')
@ApiTags('用户成长/积分管理')
export class PointController {
  constructor(private readonly userPointService: UserPointService) {}

  @Get('rules-page')
  @ApiPageDoc({
    summary: '获取用户积分规则分页',
    model: BaseUserPointRuleDto,
  })
  async getPointRules(@Query() query: QueryUserPointRuleDto) {
    return this.userPointService.getPointRulePage(query)
  }

  @Get('rules-detail')
  @ApiDoc({
    summary: '获取用户积分规则详情',
    model: BaseUserPointRuleDto,
  })
  async getPointRule(@Query() dto: IdDto) {
    return this.userPointService.getPointRuleDetail(dto.id)
  }

  @Post('rules-create')
  @ApiDoc({
    summary: '创建用户积分规则',
    model: BaseUserPointRuleDto,
  })
  async createPointRule(@Body() dto: CreateUserPointRuleDto) {
    return this.userPointService.createPointRule(dto)
  }

  @Post('rules-update')
  @ApiDoc({
    summary: '更新用户积分规则',
    model: BaseUserPointRuleDto,
  })
  async updatePointRule(@Body() dto: UpdateUserPointRuleDto) {
    return this.userPointService.updatePointRule(dto)
  }

  @Post('add-points')
  @ApiDoc({
    summary: '增加用户积分',
    model: BaseUserPointRuleDto,
  })
  async addPoints(@Body() dto: AddUserPointsDto) {
    return this.userPointService.addPoints(dto)
  }

  @Post('consume-points')
  @ApiDoc({
    summary: '扣减用户积分',
    model: BaseUserPointRuleDto,
  })
  async consumePoints(@Body() dto: ConsumeUserPointsDto) {
    return this.userPointService.consumePoints(dto)
  }

  @Get('records-page')
  @ApiPageDoc({
    summary: '获取用户积分记录分页',
    model: BaseUserPointRuleDto,
  })
  async getPointRecords(@Query() query: QueryUserPointRecordDto) {
    return this.userPointService.getPointRecordPage(query)
  }

  @Get('records-detail')
  @ApiDoc({
    summary: '获取用户积分记录详情',
    model: BaseUserPointRuleDto,
  })
  async getPointRecord(@Query() dto: IdDto) {
    return this.userPointService.getPointRecordDetail(dto.id)
  }

  @Get('user-stats')
  @ApiDoc({
    summary: '获取用户积分统计信息',
    model: BaseUserPointRuleDto,
  })
  async getUserPointStats(@Query('userId') userId: number) {
    return this.userPointService.getUserPointStats(userId)
  }

  @Post('sync-comic')
  @ApiDoc({
    summary: '同步漫画域用户积分变动',
    model: BaseUserPointRuleDto,
  })
  async syncWithComicSystem(
    @Body('userId') userId: number,
    @Body('points') points: number,
    @Body('operation') operation: 'add' | 'consume',
  ) {
    return this.userPointService.syncWithComicSystem(userId, points, operation)
  }
}
