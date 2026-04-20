import { CheckInService } from '@libs/growth/check-in/check-in.service'
import {
  CheckInConfigDetailResponseDto,
  CheckInStreakConfigDetailResponseDto,
  CheckInStreakConfigHistoryPageItemDto,
  PublishCheckInStreakConfigDto,
  QueryCheckInStreakConfigHistoryPageDto,
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

  @Get('streak/detail')
  @ApiDoc({
    summary: '查询当前连续签到配置详情',
    model: CheckInStreakConfigDetailResponseDto,
  })
  async getStreakConfigDetail() {
    return this.checkInService.getStreakConfigDetail()
  }

  @Get('streak/history/page')
  @ApiPageDoc({
    summary: '分页查询连续签到配置历史',
    model: CheckInStreakConfigHistoryPageItemDto,
  })
  async getStreakConfigHistoryPage(
    @Query() query: QueryCheckInStreakConfigHistoryPageDto,
  ) {
    return this.checkInService.getStreakConfigHistoryPage(query)
  }

  @Get('streak/history/detail')
  @ApiDoc({
    summary: '查询连续签到配置历史详情',
    model: CheckInStreakConfigDetailResponseDto,
  })
  async getStreakConfigHistoryDetail(@Query() query: IdDto) {
    return this.checkInService.getStreakConfigHistoryDetail(query)
  }

  @Post('streak/publish')
  @ApiAuditDoc({
    summary: '发布连续签到配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async publishStreakConfig(
    @Body() body: PublishCheckInStreakConfigDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.publishStreakConfig(body, userId)
  }

  @Post('streak/terminate')
  @ApiAuditDoc({
    summary: '终止连续签到配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async terminateStreakConfig(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.terminateStreakConfig(body, userId)
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
