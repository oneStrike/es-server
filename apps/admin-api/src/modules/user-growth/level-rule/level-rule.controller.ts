import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseUserLevelRuleDto,
  CheckUserLevelPermissionDto,
  CreateUserLevelRuleDto,
  QueryUserLevelRuleDto,
  UpdateUserLevelRuleDto,
  UserLevelInfoDto,
  UserLevelPermissionResultDto,
  UserLevelRuleService,
} from '@libs/user/level-rule'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/user-growth/level-rules')
@ApiTags('用户成长/等级规则管理')
export class LevelRuleController {
  constructor(private readonly levelRuleService: UserLevelRuleService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取用户等级规则分页',
    model: BaseUserLevelRuleDto,
  })
  async getLevelRules(@Query() query: QueryUserLevelRuleDto) {
    return this.levelRuleService.getLevelRulePage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取用户等级规则详情',
    model: BaseUserLevelRuleDto,
  })
  async getLevelRule(@Query() dto: IdDto) {
    return this.levelRuleService.getLevelRuleDetail(dto.id)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建用户等级规则',
    model: BaseUserLevelRuleDto,
  })
  async createLevelRule(@Body() dto: CreateUserLevelRuleDto) {
    return this.levelRuleService.createLevelRule(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新用户等级规则',
    model: BaseUserLevelRuleDto,
  })
  async updateLevelRule(@Body() dto: UpdateUserLevelRuleDto) {
    return this.levelRuleService.updateLevelRule(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除用户等级规则',
    model: BaseUserLevelRuleDto,
  })
  async deleteLevelRule(@Body() dto: IdDto) {
    return this.levelRuleService.deleteLevelRule(dto.id)
  }

  @Get('user-level-info')
  @ApiDoc({
    summary: '获取用户等级信息详情',
    model: UserLevelInfoDto,
  })
  async getUserLevelInfo(@Query() dto: IdDto) {
    return this.levelRuleService.getUserLevelInfo(dto.id)
  }

  @Post('check-permission')
  @ApiDoc({
    summary: '检查用户等级权限配置',
    model: UserLevelPermissionResultDto,
  })
  async checkLevelPermission(@Body() dto: CheckUserLevelPermissionDto) {
    return this.levelRuleService.checkLevelPermission(dto)
  }

  @Get('statistics')
  @ApiDoc({
    summary: '获取用户等级统计信息',
    model: BaseUserLevelRuleDto,
  })
  async getLevelStatistics() {
    return this.levelRuleService.getLevelStatistics()
  }
}
