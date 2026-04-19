import type { PageDto } from '@libs/platform/dto/page.dto'
import type {
  UpdateCheckInConfigDto,
  UpdateCheckInEnabledDto,
  UpdateCheckInStreakRoundDto,
} from './dto/check-in-definition.dto'
import type {
  MakeupCheckInDto,
  RepairCheckInRewardDto,
} from './dto/check-in-execution.dto'
import type {
  QueryCheckInLeaderboardDto,
  QueryCheckInReconciliationDto,
} from './dto/check-in-runtime.dto'
import { Injectable } from '@nestjs/common'
import { CheckInDefinitionService } from './check-in-definition.service'
import { CheckInExecutionService } from './check-in-execution.service'
import { CheckInRuntimeService } from './check-in-runtime.service'

/**
 * 签到域对外门面服务。
 *
 * 统一向 app/admin controller 暴露签到模块公开用例。
 */
@Injectable()
export class CheckInService {
  constructor(
    private readonly checkInDefinitionService: CheckInDefinitionService,
    private readonly checkInExecutionService: CheckInExecutionService,
    private readonly checkInRuntimeService: CheckInRuntimeService,
  ) {}

  async getConfigDetail() {
    return this.checkInDefinitionService.getConfigDetail()
  }

  async updateConfig(dto: UpdateCheckInConfigDto, adminUserId: number) {
    return this.checkInDefinitionService.updateConfig(dto, adminUserId)
  }

  async updateEnabled(dto: UpdateCheckInEnabledDto, adminUserId: number) {
    return this.checkInDefinitionService.updateEnabled(dto, adminUserId)
  }

  async getRoundDetail() {
    return this.checkInDefinitionService.getRoundDetail()
  }

  async updateRound(dto: UpdateCheckInStreakRoundDto, adminUserId: number) {
    return this.checkInDefinitionService.updateRound(dto, adminUserId)
  }

  async getSummary(userId: number) {
    return this.checkInRuntimeService.getSummary(userId)
  }

  async getCalendar(userId: number) {
    return this.checkInRuntimeService.getCalendar(userId)
  }

  async getMyRecords(query: PageDto, userId: number) {
    return this.checkInRuntimeService.getMyRecords(query, userId)
  }

  async getLeaderboardPage(query: QueryCheckInLeaderboardDto) {
    return this.checkInRuntimeService.getLeaderboardPage(query)
  }

  async signToday(userId: number) {
    return this.checkInExecutionService.signToday(userId)
  }

  async makeup(dto: MakeupCheckInDto, userId: number) {
    return this.checkInExecutionService.makeup(dto, userId)
  }

  async getReconciliationPage(query: QueryCheckInReconciliationDto) {
    return this.checkInRuntimeService.getReconciliationPage(query)
  }

  async repairReward(dto: RepairCheckInRewardDto, adminUserId: number) {
    return this.checkInExecutionService.repairReward(dto, adminUserId)
  }
}
