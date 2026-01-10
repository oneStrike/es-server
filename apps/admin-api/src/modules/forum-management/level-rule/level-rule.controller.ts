import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseLevelRuleDto,
  CheckLevelPermissionDto,
  CreateLevelRuleDto,
  LevelPermissionResultDto,
  LevelRuleService,
  QueryLevelRuleDto,
  UpdateLevelRuleDto,
  UserLevelInfoDto,
} from '@libs/forum'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/level-rules')
@ApiTags('论坛模块/等级规则管理')
export class LevelRuleController {
  constructor(private readonly levelRuleService: LevelRuleService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取等级规则分页',
    model: BaseLevelRuleDto,
  })
  async getLevelRules(@Query() query: QueryLevelRuleDto) {
    return this.levelRuleService.getLevelRulePage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取等级规则详情',
    model: BaseLevelRuleDto,
  })
  async getLevelRule(@Query() dto: IdDto) {
    return this.levelRuleService.getLevelRuleDetail(dto.id)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建等级规则',
    model: BaseLevelRuleDto,
  })
  async createLevelRule(@Body() dto: CreateLevelRuleDto) {
    return this.levelRuleService.createLevelRule(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新等级规则',
    model: BaseLevelRuleDto,
  })
  async updateLevelRule(@Body() dto: UpdateLevelRuleDto) {
    return this.levelRuleService.updateLevelRule(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除等级规则',
    model: BaseLevelRuleDto,
  })
  async deleteLevelRule(@Body() dto: IdDto) {
    return this.levelRuleService.deleteLevelRule(dto.id)
  }

  @Get('user-level-info')
  @ApiDoc({
    summary: '获取用户等级信息',
    model: UserLevelInfoDto,
  })
  async getUserLevelInfo(@Query() dto: IdDto) {
    return this.levelRuleService.getUserLevelInfo(dto.id)
  }

  @Post('check-permission')
  @ApiDoc({
    summary: '检查用户等级权限',
    model: LevelPermissionResultDto,
  })
  async checkLevelPermission(@Body() dto: CheckLevelPermissionDto) {
    return this.levelRuleService.checkLevelPermission(dto)
  }

  @Get('statistics')
  @ApiDoc({
    summary: '获取等级统计信息',
    model: BaseLevelRuleDto,
  })
  async getLevelStatistics() {
    return this.levelRuleService.getLevelStatistics()
  }
}
