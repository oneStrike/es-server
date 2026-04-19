import { CheckInService } from '@libs/growth/check-in/check-in.service'
import {
  CheckInConfigDetailResponseDto,
  CheckInStreakRoundDetailResponseDto,
  UpdateCheckInConfigDto,
  UpdateCheckInEnabledDto,
  UpdateCheckInStreakRoundDto,
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

  @Get('streak-round/detail')
  @ApiDoc({
    summary: '查询当前连续奖励轮次详情',
    model: CheckInStreakRoundDetailResponseDto,
  })
  async getRoundDetail() {
    return this.checkInService.getRoundDetail()
  }

  @Post('streak-round/update')
  @ApiAuditDoc({
    summary: '更新连续奖励轮次配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateRound(
    @Body() body: UpdateCheckInStreakRoundDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updateRound(body, userId)
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
