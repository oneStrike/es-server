import type { PageDto } from '@libs/platform/dto/page.dto'
import type {
  CreateCheckInActivityStreakDto,
  PublishCheckInDailyStreakConfigDto,
  QueryCheckInActivityStreakPageDto,
  QueryCheckInDailyStreakConfigHistoryPageDto,
  UpdateCheckInActivityStreakDto,
  UpdateCheckInActivityStreakStatusDto,
  UpdateCheckInConfigDto,
  UpdateCheckInEnabledDto,
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

  async getDailyStreakConfigDetail() {
    return this.checkInDefinitionService.getDailyStreakConfigDetail()
  }

  async getDailyStreakConfigHistoryPage(
    query: QueryCheckInDailyStreakConfigHistoryPageDto,
  ) {
    return this.checkInDefinitionService.getDailyStreakConfigHistoryPage(query)
  }

  async getDailyStreakConfigHistoryDetail(query: { id: number }) {
    return this.checkInDefinitionService.getDailyStreakConfigHistoryDetail(
      query,
    )
  }

  async publishDailyStreakConfig(
    dto: PublishCheckInDailyStreakConfigDto,
    adminUserId: number,
  ) {
    return this.checkInDefinitionService.publishDailyStreakConfig(
      dto,
      adminUserId,
    )
  }

  async terminateDailyStreakConfig(query: { id: number }, adminUserId: number) {
    return this.checkInDefinitionService.terminateDailyStreakConfig(
      query,
      adminUserId,
    )
  }

  async getActivityStreakPage(query: QueryCheckInActivityStreakPageDto) {
    return this.checkInDefinitionService.getActivityStreakPage(query)
  }

  async getActivityStreakDetail(query: { id: number }) {
    return this.checkInDefinitionService.getActivityStreakDetail(query)
  }

  async createActivityStreak(
    dto: CreateCheckInActivityStreakDto,
    adminUserId: number,
  ) {
    return this.checkInDefinitionService.createActivityStreak(dto, adminUserId)
  }

  async updateActivityStreak(
    dto: UpdateCheckInActivityStreakDto,
    adminUserId: number,
  ) {
    return this.checkInDefinitionService.updateActivityStreak(dto, adminUserId)
  }

  async updateActivityStreakStatus(
    dto: UpdateCheckInActivityStreakStatusDto,
    adminUserId: number,
  ) {
    return this.checkInDefinitionService.updateActivityStreakStatus(
      dto,
      adminUserId,
    )
  }

  async deleteActivityStreak(query: { id: number }) {
    return this.checkInDefinitionService.deleteActivityStreak(query)
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

  async getActivityPage(
    query: QueryCheckInActivityStreakPageDto,
    userId: number,
  ) {
    return this.checkInRuntimeService.getActivityPage(query, userId)
  }

  async getActivityDetail(query: { id: number }, userId: number) {
    return this.checkInRuntimeService.getActivityDetail(query, userId)
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
