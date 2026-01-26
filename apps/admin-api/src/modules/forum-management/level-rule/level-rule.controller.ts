import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseForumLevelRuleDto,
  CheckForumLevelPermissionDto,
  CreateForumLevelRuleDto,
  ForumLevelPermissionResultDto,
  ForumLevelRuleService,
  QueryForumLevelRuleDto,
  UpdateForumLevelRuleDto,
  UserForumLevelInfoDto,
} from '@libs/user/level-rule'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/level-rules')
@ApiTags('论坛模块/等级规则管理')
export class LevelRuleController {
  constructor(private readonly levelRuleService: ForumLevelRuleService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取等级规则分页',
    model: BaseForumLevelRuleDto,
  })
  async getLevelRules(@Query() query: QueryForumLevelRuleDto) {
    return this.levelRuleService.getLevelRulePage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取等级规则详情',
    model: BaseForumLevelRuleDto,
  })
  async getLevelRule(@Query() dto: IdDto) {
    return this.levelRuleService.getLevelRuleDetail(dto.id)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建等级规则',
    model: BaseForumLevelRuleDto,
  })
  async createLevelRule(@Body() dto: CreateForumLevelRuleDto) {
    return this.levelRuleService.createLevelRule(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新等级规则',
    model: BaseForumLevelRuleDto,
  })
  async updateLevelRule(@Body() dto: UpdateForumLevelRuleDto) {
    return this.levelRuleService.updateLevelRule(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除等级规则',
    model: BaseForumLevelRuleDto,
  })
  async deleteLevelRule(@Body() dto: IdDto) {
    return this.levelRuleService.deleteLevelRule(dto.id)
  }

  @Get('user-level-info')
  @ApiDoc({
    summary: '获取用户等级信息',
    model: UserForumLevelInfoDto,
  })
  async getUserLevelInfo(@Query() dto: IdDto) {
    return this.levelRuleService.getUserLevelInfo(dto.id)
  }

  @Post('check-permission')
  @ApiDoc({
    summary: '检查用户等级权限',
    model: ForumLevelPermissionResultDto,
  })
  async checkLevelPermission(@Body() dto: CheckForumLevelPermissionDto) {
    return this.levelRuleService.checkLevelPermission(dto)
  }

  @Get('statistics')
  @ApiDoc({
    summary: '获取等级统计信息',
    model: BaseForumLevelRuleDto,
  })
  async getLevelStatistics() {
    return this.levelRuleService.getLevelStatistics()
  }
}
