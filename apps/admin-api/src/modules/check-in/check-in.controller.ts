import { CheckInService } from '@libs/growth/check-in/check-in.service'
import {
  AdminCheckInCalendarDetailResponseDto,
  AdminCheckInCalendarOverviewResponseDto,
  AdminCheckInSignedUserPageItemDto,
} from '@libs/growth/check-in/dto/check-in-calendar-admin.dto'
import {
  QueryAdminCheckInSignedUserPageDto,
  QueryAdminUserCheckInCalendarDetailDto,
  QueryCheckInCalendarDetailDto,
} from '@libs/growth/check-in/dto/check-in-calendar-query.dto'
import {
  CheckInConfigDetailResponseDto,
  CheckInStreakRuleDetailResponseDto,
  PublishCheckInStreakRuleDto,
  QueryCheckInStreakRuleHistoryPageDto,
  QueryCheckInStreakRulePageDto,
  UpdateCheckInConfigDto,
  UpdateCheckInEnabledDto,
} from '@libs/growth/check-in/dto/check-in-definition.dto'
import {
  RepairCheckInRewardDto,
  RepairCheckInRewardResponseDto,
  RepairCheckInStreakDto,
  RepairCheckInStreakResponseDto,
} from '@libs/growth/check-in/dto/check-in-execution.dto'
import {
  CheckInCalendarResponseDto,
  CheckInReconciliationPageItemDto,
  QueryCheckInReconciliationDto,
} from '@libs/growth/check-in/dto/check-in-runtime.dto'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'

import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('签到管理')
@Controller('admin/check-in')
export class CheckInController {
  // 注入签到门面服务，统一复用 libs 内的真实业务实现。
  constructor(private readonly checkInService: CheckInService) {}

  @Get('config/detail')
  @AdminPermission({
    code: 'check:in:config:detail',
    name: '查询签到配置详情',
    groupCode: 'check:in',
  })
  @ApiDoc({
    summary: '查询签到配置详情',
    model: CheckInConfigDetailResponseDto,
  })
  // 查询后台签到配置详情。
  async getConfigDetail() {
    return this.checkInService.getConfigDetail()
  }

  @Get('calendar/detail')
  @AdminPermission({
    code: 'check:in:calendar:detail',
    name: '查询目标周期全局签到日历',
    groupCode: 'check:in',
  })
  @ApiDoc({
    summary: '查询目标周期全局签到日历',
    model: AdminCheckInCalendarDetailResponseDto,
  })
  // 查询后台目标日期所属周期的全局签到日历汇总。
  async getCalendarDetail(@Query() query: QueryCheckInCalendarDetailDto) {
    return this.checkInService.getAdminCalendarDetail(query)
  }

  @Get('calendar/overview')
  @AdminPermission({
    code: 'check:in:calendar:overview',
    name: '查询目标周期签到轻量概览',
    groupCode: 'check:in',
  })
  @ApiDoc({
    summary: '查询目标周期签到轻量概览',
    model: AdminCheckInCalendarOverviewResponseDto,
  })
  // 查询后台目标日期所属周期的轻量计数概览，不返回奖励快照和补偿诊断。
  async getCalendarOverview(@Query() query: QueryCheckInCalendarDetailDto) {
    return this.checkInService.getAdminCalendarOverview(query)
  }

  @Get('calendar/user/detail')
  @AdminPermission({
    code: 'check:in:calendar:user:detail',
    name: '查询指定用户目标周期签到日历',
    groupCode: 'check:in',
  })
  @ApiDoc({
    summary: '查询指定用户目标周期签到日历',
    model: CheckInCalendarResponseDto,
  })
  // 查询后台指定用户在目标日期所属周期的签到日历。
  async getUserCalendarDetail(
    @Query() query: QueryAdminUserCheckInCalendarDetailDto,
  ) {
    return this.checkInService.getAdminUserCalendarDetail(query)
  }

  @Get('calendar/signed-user/page')
  @AdminPermission({
    code: 'check:in:calendar:signed:user:page',
    name: '分页查询某日已签用户列表',
    groupCode: 'check:in',
  })
  @ApiPageDoc({
    summary: '分页查询某日已签用户列表',
    model: AdminCheckInSignedUserPageItemDto,
  })
  // 分页查询指定自然日的已签用户列表。
  async getSignedUserPage(@Query() query: QueryAdminCheckInSignedUserPageDto) {
    return this.checkInService.getAdminSignedUserPage(query)
  }

  @Post('config/update')
  @AdminPermission({
    code: 'check:in:config:update',
    name: '更新签到配置',
    groupCode: 'check:in',
  })
  @ApiAuditDoc({
    summary: '更新签到配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 更新后台签到配置主体。
  async updateConfig(
    @Body() body: UpdateCheckInConfigDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updateConfig(body, userId)
  }

  @Post('config/update-enabled')
  @AdminPermission({
    code: 'check:in:config:update:enabled',
    name: '更新签到开关',
    groupCode: 'check:in',
  })
  @ApiAuditDoc({
    summary: '更新签到开关',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 仅更新签到启停开关。
  async updateEnabled(
    @Body() body: UpdateCheckInEnabledDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updateEnabled(body, userId)
  }

  @Get('streak/page')
  @AdminPermission({
    code: 'check:in:streak:page',
    name: '分页查询连续签到记录',
    groupCode: 'check:in',
  })
  @ApiPageDoc({
    summary: '分页查询连续签到记录',
    model: CheckInStreakRuleDetailResponseDto,
  })
  // 分页查询连续签到规则代表版本。
  async getStreakRulePage(@Query() query: QueryCheckInStreakRulePageDto) {
    return this.checkInService.getStreakRulePage(query)
  }

  @Get('streak/detail')
  @AdminPermission({
    code: 'check:in:streak:detail',
    name: '查询连续签到记录详情',
    groupCode: 'check:in',
  })
  @ApiDoc({
    summary: '查询连续签到记录详情',
    model: CheckInStreakRuleDetailResponseDto,
  })
  // 查询单条连续签到规则详情。
  async getStreakRuleDetail(@Query() query: IdDto) {
    return this.checkInService.getStreakRuleDetail(query)
  }

  @Get('streak/history/page')
  @AdminPermission({
    code: 'check:in:streak:history:page',
    name: '分页查询连续签到记录历史',
    groupCode: 'check:in',
  })
  @ApiPageDoc({
    summary: '分页查询连续签到记录历史',
    model: CheckInStreakRuleDetailResponseDto,
  })
  // 分页查询同一阈值规则的历史版本。
  async getStreakRuleHistoryPage(
    @Query() query: QueryCheckInStreakRuleHistoryPageDto,
  ) {
    return this.checkInService.getStreakRuleHistoryPage(query)
  }

  @Get('streak/history/detail')
  @AdminPermission({
    code: 'check:in:streak:history:detail',
    name: '查询连续签到记录历史详情',
    groupCode: 'check:in',
  })
  @ApiDoc({
    summary: '查询连续签到记录历史详情',
    model: CheckInStreakRuleDetailResponseDto,
  })
  // 查询某条历史版本规则详情。
  async getStreakRuleHistoryDetail(@Query() query: IdDto) {
    return this.checkInService.getStreakRuleHistoryDetail(query)
  }

  @Post('streak/publish')
  @AdminPermission({
    code: 'check:in:streak:publish',
    name: '发布连续签到记录',
    groupCode: 'check:in',
  })
  @ApiAuditDoc({
    summary: '发布连续签到记录',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 发布新的连续签到规则版本。
  async publishStreakRule(
    @Body() body: PublishCheckInStreakRuleDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.publishStreakRule(body, userId)
  }

  @Post('streak/terminate')
  @AdminPermission({
    code: 'check:in:streak:terminate',
    name: '终止连续签到记录',
    groupCode: 'check:in',
  })
  @ApiAuditDoc({
    summary: '终止连续签到记录',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 终止当前仍可终止的连续签到规则版本。
  async terminateStreakRule(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.terminateStreakRule(body, userId)
  }

  @Get('reconciliation/page')
  @AdminPermission({
    code: 'check:in:reconciliation:page',
    name: '分页查询签到对账结果',
    groupCode: 'check:in',
  })
  @ApiPageDoc({
    summary: '分页查询签到对账结果',
    model: CheckInReconciliationPageItemDto,
  })
  // 分页查询签到奖励对账结果。
  async getReconciliationPage(@Query() query: QueryCheckInReconciliationDto) {
    return this.checkInService.getReconciliationPage(query)
  }

  @Post('reconciliation/repair')
  @AdminPermission({
    code: 'check:in:reconciliation:repair',
    name: '补偿签到奖励',
    groupCode: 'check:in',
  })
  @ApiAuditDoc({
    summary: '补偿签到奖励',
    model: RepairCheckInRewardResponseDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 手动触发签到奖励补偿重试。
  async repairReward(
    @Body() body: RepairCheckInRewardDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.repairReward(body, userId)
  }

  @Post('streak/repair')
  @AdminPermission({
    code: 'check:in:streak:repair',
    name: '重算连续签到进度',
    groupCode: 'check:in',
  })
  @ApiAuditDoc({
    summary: '重算连续签到进度',
    model: RepairCheckInStreakResponseDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 手动重算指定用户连续签到进度，并补齐缺失的连续奖励发放。
  async repairStreak(
    @Body() body: RepairCheckInStreakDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.repairStreak(body, userId)
  }
}
