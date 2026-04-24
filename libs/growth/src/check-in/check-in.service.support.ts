import type { Db, DrizzleService } from '@db/core'
import type { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import type {
  CheckInDateLike,
  CheckInNullableDateLike,
} from './check-in.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  formatDateOnlyInAppTimeZone,
  parseDateOnlyInAppTimeZone,
} from '@libs/platform/utils'
import { BadRequestException, Logger } from '@nestjs/common'
import { desc } from 'drizzle-orm'

/**
 * 统一签到域 support 基类。
 *
 * 只保留签到域各 service 共用的底层依赖、日期工具、owner getter 和少量通用查询。
 */
export abstract class CheckInServiceSupport {
  protected readonly logger = new Logger(CheckInServiceSupport.name)

  // 注入签到域共享的数据库访问和账本依赖。
  constructor(
    protected readonly drizzle: DrizzleService,
    protected readonly growthLedgerService: GrowthLedgerService,
  ) {}

  // 暴露当前 Drizzle 数据库实例。
  protected get db() {
    return this.drizzle.db
  }

  // 暴露签到配置表 owner。
  protected get checkInConfigTable() {
    return this.drizzle.schema.checkInConfig
  }

  // 暴露补签事实表 owner。
  protected get checkInMakeupFactTable() {
    return this.drizzle.schema.checkInMakeupFact
  }

  // 暴露补签账户表 owner。
  protected get checkInMakeupAccountTable() {
    return this.drizzle.schema.checkInMakeupAccount
  }

  // 暴露签到事实表 owner。
  protected get checkInRecordTable() {
    return this.drizzle.schema.checkInRecord
  }

  // 暴露连续签到规则表 owner。
  protected get checkInStreakRuleTable() {
    return this.drizzle.schema.checkInStreakRule
  }

  // 暴露连续签到规则奖励项表 owner。
  protected get checkInStreakRuleRewardItemTable() {
    return this.drizzle.schema.checkInStreakRuleRewardItem
  }

  // 暴露连续签到进度表 owner。
  protected get checkInStreakProgressTable() {
    return this.drizzle.schema.checkInStreakProgress
  }

  // 暴露连续签到奖励发放表 owner。
  protected get checkInStreakGrantTable() {
    return this.drizzle.schema.checkInStreakGrant
  }

  // 暴露连续签到奖励发放奖励项表 owner。
  protected get checkInStreakGrantRewardItemTable() {
    return this.drizzle.schema.checkInStreakGrantRewardItem
  }

  // 暴露通用成长奖励补偿表 owner。
  protected get growthRewardSettlementTable() {
    return this.drizzle.schema.growthRewardSettlement
  }

  // 把 Date 或日期字符串规范化成 YYYY-MM-DD。
  protected formatDateOnly(value: CheckInDateLike) {
    return formatDateOnlyInAppTimeZone(value)
  }

  // 解析日期字符串；非法时统一抛协议层参数错误。
  protected parseDateOnly(value: string, fieldLabel = '日期') {
    const parsed = parseDateOnlyInAppTimeZone(value)
    if (!parsed) {
      throw new BadRequestException(`${fieldLabel}非法`)
    }
    return this.formatDateOnly(parsed)
  }

  // 把 Date / string / null 统一折叠成日期字符串或空串。
  protected toDateOnlyValue(value: CheckInNullableDateLike) {
    if (!value) {
      return ''
    }
    return typeof value === 'string' ? value : this.formatDateOnly(value)
  }

  // 仅在输入是普通对象时返回可安全读取的记录结构。
  protected asRecord<T>(value: T) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }
    return value as Record<string, unknown>
  }

  // 仅在输入是数组时返回原数组。
  protected asArray<T>(value: T) {
    return Array.isArray(value) ? value : undefined
  }

  // 计算按签到日期回看配置时应使用的查询时间点。
  protected resolveConfigLookupAt(signDate: string) {
    return parseDateOnlyInAppTimeZone(signDate)!
  }

  // 读取当前唯一的签到配置；配置缺失时返回空值。
  protected async getCurrentConfig(db: Db = this.db) {
    const [config] = await db
      .select()
      .from(this.checkInConfigTable)
      .orderBy(
        desc(this.checkInConfigTable.updatedAt),
        desc(this.checkInConfigTable.id),
      )
      .limit(1)
    return config
  }

  // 读取当前签到配置；缺失时统一抛资源不存在异常。
  protected async getRequiredConfig(db: Db = this.db) {
    const config = await this.getCurrentConfig(db)
    if (!config) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '签到配置不存在',
      )
    }
    return config
  }

  // 读取当前已启用的签到配置；未开启时统一抛业务异常。
  protected async getEnabledConfig(db: Db = this.db) {
    const config = await this.getRequiredConfig(db)
    if (config.isEnabled !== 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '签到功能未开启',
      )
    }
    return config
  }

  // 校验目标用户是否存在，避免后续事实写入出现悬空引用。
  protected async ensureUserExists(userId: number, db: Db = this.db) {
    const user = await db.query.appUser.findFirst({
      where: { id: userId },
      columns: { id: true },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
  }

  // 找出字符串列表中的第一个重复值。
  protected findDuplicateValue(values: string[]) {
    const seen = new Set<string>()
    for (const value of values) {
      if (seen.has(value)) {
        return value
      }
      seen.add(value)
    }
    return undefined
  }
}
