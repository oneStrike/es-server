import {
  BaseUserLevelRuleDto,
  CheckUserLevelPermissionDto,
  CreateUserLevelRuleDto,
  QueryUserLevelRuleDto,
  UpdateUserLevelRuleDto,
  UserLevelInfoDto,
  UserLevelPermissionResultDto,
  UserLevelRuleService,
  UserLevelStatisticsDto,
} from '@libs/growth/level-rule'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

/**
 * 用户等级规则管理控制器
 * 提供等级规则的创建、更新、删除、查询等管理接口。
 */
@Controller('admin/growth/level-rules')
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
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '创建用户等级规则',
  })
  async createLevelRule(@Body() dto: CreateUserLevelRuleDto) {
    return this.levelRuleService.createLevelRule(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新用户等级规则',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新用户等级规则',
  })
  async updateLevelRule(@Body() dto: UpdateUserLevelRuleDto) {
    return this.levelRuleService.updateLevelRule(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除用户等级规则',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除用户等级规则',
  })
  async deleteLevelRule(@Body() dto: IdDto) {
    return this.levelRuleService.deleteLevelRule(dto.id)
  }

  @Get('user/detail')
  @ApiDoc({
    summary: '获取用户等级信息详情',
    model: UserLevelInfoDto,
  })
  async getUserLevelInfo(@Query() dto: IdDto) {
    return this.levelRuleService.getUserLevelInfo(dto.id)
  }

  @Post('permission/check')
  @ApiDoc({
    summary: '检查用户等级权限配置',
    model: UserLevelPermissionResultDto,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '检查用户等级权限配置',
  })
  async checkLevelPermission(@Body() dto: CheckUserLevelPermissionDto) {
    return this.levelRuleService.checkLevelPermission(dto)
  }

  @Get('stats')
  @ApiDoc({
    summary: '获取用户等级统计信息',
    model: UserLevelStatisticsDto,
  })
  async getLevelStatistics() {
    return this.levelRuleService.getLevelStatistics()
  }
}
