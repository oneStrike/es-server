import { CheckInService } from '@libs/growth/check-in/check-in.service'
import {
  CheckInActivityStreakDetailResponseDto,
  CheckInActivityStreakPageItemDto,
  CheckInConfigDetailResponseDto,
  CheckInDailyStreakConfigDetailResponseDto,
  CheckInDailyStreakConfigHistoryPageItemDto,
  CreateCheckInActivityStreakDto,
  PublishCheckInDailyStreakConfigDto,
  QueryCheckInActivityStreakPageDto,
  QueryCheckInDailyStreakConfigHistoryPageDto,
  UpdateCheckInActivityStreakDto,
  UpdateCheckInActivityStreakStatusDto,
  UpdateCheckInConfigDto,
  UpdateCheckInEnabledDto,
} from '@libs/growth/check-in/dto/check-in-definition.dto'
import {
  RepairCheckInRewardDto,
  RepairCheckInRewardResponseDto,
} from '@libs/growth/check-in/dto/check-in-execution.dto'
import {
  CheckInReconciliationItemDto,
  QueryCheckInReconciliationDto,
} from '@libs/growth/check-in/dto/check-in-runtime.dto'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator'
import { IdDto } from '@libs/platform/dto/base.dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('签到管理')
@Controller('admin/check-in')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Get('config/detail')
  @ApiDoc({
    summary: '查询签到配置详情',
    model: CheckInConfigDetailResponseDto,
  })
  async getConfigDetail() {
    return this.checkInService.getConfigDetail()
  }

  @Post('config/update')
  @ApiAuditDoc({
    summary: '更新签到配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateConfig(
    @Body() body: UpdateCheckInConfigDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updateConfig(body, userId)
  }

  @Post('config/update-enabled')
  @ApiAuditDoc({
    summary: '更新签到开关',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateEnabled(
    @Body() body: UpdateCheckInEnabledDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updateEnabled(body, userId)
  }

  @Get('daily-streak/detail')
  @ApiDoc({
    summary: '查询当前日常连续签到配置详情',
    model: CheckInDailyStreakConfigDetailResponseDto,
  })
  async getDailyStreakConfigDetail() {
    return this.checkInService.getDailyStreakConfigDetail()
  }

  @Get('daily-streak/history/page')
  @ApiPageDoc({
    summary: '分页查询日常连续签到配置历史',
    model: CheckInDailyStreakConfigHistoryPageItemDto,
  })
  async getDailyStreakConfigHistoryPage(
    @Query() query: QueryCheckInDailyStreakConfigHistoryPageDto,
  ) {
    return this.checkInService.getDailyStreakConfigHistoryPage(query)
  }

  @Get('daily-streak/history/detail')
  @ApiDoc({
    summary: '查询日常连续签到配置历史详情',
    model: CheckInDailyStreakConfigDetailResponseDto,
  })
  async getDailyStreakConfigHistoryDetail(@Query() query: IdDto) {
    return this.checkInService.getDailyStreakConfigHistoryDetail(query)
  }

  @Post('daily-streak/publish')
  @ApiAuditDoc({
    summary: '发布日常连续签到配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async publishDailyStreakConfig(
    @Body() body: PublishCheckInDailyStreakConfigDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.publishDailyStreakConfig(body, userId)
  }

  @Post('daily-streak/terminate')
  @ApiAuditDoc({
    summary: '终止日常连续签到配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async terminateDailyStreakConfig(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.terminateDailyStreakConfig(body, userId)
  }

  @Get('activity-streak/page')
  @ApiPageDoc({
    summary: '分页查询活动连续签到',
    model: CheckInActivityStreakPageItemDto,
  })
  async getActivityStreakPage(
    @Query() query: QueryCheckInActivityStreakPageDto,
  ) {
    return this.checkInService.getActivityStreakPage(query)
  }

  @Get('activity-streak/detail')
  @ApiDoc({
    summary: '查询活动连续签到详情',
    model: CheckInActivityStreakDetailResponseDto,
  })
  async getActivityStreakDetail(@Query() query: IdDto) {
    return this.checkInService.getActivityStreakDetail(query)
  }

  @Post('activity-streak/create')
  @ApiAuditDoc({
    summary: '创建活动连续签到',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createActivityStreak(
    @Body() body: CreateCheckInActivityStreakDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.createActivityStreak(body, userId)
  }

  @Post('activity-streak/update')
  @ApiAuditDoc({
    summary: '更新活动连续签到',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateActivityStreak(
    @Body() body: UpdateCheckInActivityStreakDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updateActivityStreak(body, userId)
  }

  @Post('activity-streak/update-status')
  @ApiAuditDoc({
    summary: '更新活动连续签到状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateActivityStreakStatus(
    @Body() body: UpdateCheckInActivityStreakStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updateActivityStreakStatus(body, userId)
  }

  @Post('activity-streak/delete')
  @ApiAuditDoc({
    summary: '删除活动连续签到',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteActivityStreak(@Body() body: IdDto) {
    return this.checkInService.deleteActivityStreak(body)
  }

  @Get('reconciliation/page')
  @ApiPageDoc({
    summary: '分页查询签到对账结果',
    model: CheckInReconciliationItemDto,
  })
  async getReconciliationPage(@Query() query: QueryCheckInReconciliationDto) {
    return this.checkInService.getReconciliationPage(query)
  }

  @Post('reconciliation/repair')
  @ApiAuditDoc({
    summary: '补偿签到奖励',
    model: RepairCheckInRewardResponseDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async repairReward(
    @Body() body: RepairCheckInRewardDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.repairReward(body, userId)
  }
}
