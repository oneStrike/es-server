import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseUserPointRuleDto,
  CreateUserPointRuleDto,
  QueryUserPointRuleDto,
  UpdateUserPointRuleDto,
  UserPointRuleService,
} from '@libs/user/point'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/user-growth/points-rules')
@ApiTags('用户成长/积分管理')
export class PointController {
  constructor(private readonly userPointRuleService: UserPointRuleService) {}

  @Get('rules-page')
  @ApiPageDoc({
    summary: '获取积分规则分页',
    model: BaseUserPointRuleDto,
  })
  async getPointRules(@Query() query: QueryUserPointRuleDto) {
    return this.userPointRuleService.getPointRulePage(query)
  }

  @Get('rules-detail')
  @ApiDoc({
    summary: '获取积分规则详情',
    model: BaseUserPointRuleDto,
  })
  async getPointRule(@Query() dto: IdDto) {
    return this.userPointRuleService.getPointRuleDetail(dto.id)
  }

  @Post('rules-create')
  @ApiDoc({
    summary: '创建积分规则',
    model: BaseUserPointRuleDto,
  })
  async createPointRule(@Body() dto: CreateUserPointRuleDto) {
    return this.userPointRuleService.createPointRule(dto)
  }

  @Post('rules-update')
  @ApiDoc({
    summary: '更新积分规则',
    model: BaseUserPointRuleDto,
  })
  async updatePointRule(@Body() dto: UpdateUserPointRuleDto) {
    return this.userPointRuleService.updatePointRule(dto)
  }
}
