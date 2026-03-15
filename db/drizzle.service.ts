import type {
  Db,
  DrizzleColumnKey,
  DrizzleSql,
  DrizzleWhere,
  DrizzleWhereOptions,
  PgTable,
} from './drizzle.type'
import {
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnApplicationShutdown,
} from '@nestjs/common'
import {
  and,
  between,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  not,
  or,
} from 'drizzle-orm'
import { Pool } from 'pg'
import {
  getPostgresError,
  PostgresDefaultMessages,
  PostgresError,
  PostgresErrorCode,
  PostgresHttpStatus,
} from './constants/postgres-error'
import { createDrizzleExtensions } from './drizzle.extensions'
import { DRIZZLE_DB, DRIZZLE_POOL } from './drizzle.provider'
import * as schema from './schema'

/**
 * Drizzle 数据库服务
 *
 * 核心职责:
 * - 管理数据库连接生命周期
 * - 提供 PostgreSQL 错误检测与处理能力
 * - 提供 Drizzle 扩展方法集合
 * - 提供事务管理和结果断言工具
 *
 * @example
 * // 错误检测
 * if (this.db.isUniqueViolation(error)) { ... }
 *
 * // 错误处理
 * await this.db.withErrorHandling(() => this.db.insert(users).values(data), {
 *   duplicate: '用户名已存在'
 * })
 *
 * // 结果断言
 * const [user] = this.db.assertNotEmpty(result, '用户不存在')
 */
@Injectable()
export class DrizzleService implements OnApplicationShutdown {
  // ==================== 属性与构造函数 ====================

  /** Drizzle 扩展方法集合 */
  public readonly ext: ReturnType<typeof createDrizzleExtensions>

  /** 用于转义 LIKE 模式的正则表达式 */
  private readonly BACKSLASH_REGEX = /\\/g
  private readonly PERCENT_REGEX = /%/g
  private readonly UNDERSCORE_REGEX = /_/g

  constructor(
    /** Drizzle 数据库实例 */
    @Inject(DRIZZLE_DB) public readonly db: Db,
    /** PostgreSQL 连接池 */
    @Inject(DRIZZLE_POOL) private readonly pool: Pool,
  ) {
    this.ext = createDrizzleExtensions(this.db)
  }

  // ==================== 生命周期方法 ====================

  /**
   * 应用程序关闭时的清理操作
   * @description 关闭数据库连接池，释放资源
   */
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }

  // ==================== 访问器属性 ====================

  /**
   * 获取数据库 Schema 定义
   * @returns 数据库 Schema 对象
   */
  get schema(): typeof schema {
    return schema
  }

  /**
   * 构建查询条件
   *
   * @description 根据配置自动构建 WHERE 条件
   * @param table Drizzle 表对象
   * @param data 查询参数对象
   * @param options 构建配置
   * @param options.eq 等值匹配字段列表
   * @param options.like 模糊匹配字段列表（ILIKE %value%）
   * @param options.in IN 查询字段列表（数组值）
   * @param options.gte 大于等于字段列表（对应 data 中 fieldGte）
   * @param options.lte 小于等于字段列表（对应 data 中 fieldLte）
   * @returns SQL 条件（可直接用于 where）
   *
   * @example
   * // 等值匹配
   * buildWhereAnd(taskTable, dto, { eq: ['status', 'type', 'isEnabled'] })
   *
   * @example
   * // 模糊匹配（ILIKE %value%）
   * buildWhereAnd(taskTable, dto, { like: ['title', 'code'] })
   *
   * @example
   * // IN 查询（数组）
   * buildWhereAnd(taskTable, dto, { inArray: ['type'] })
   *
   * @example
   * // 范围查询（字段名 + Gte/Lte 后缀）
   * // dto: { createdAtGte: start, createdAtLte: end }
   * buildWhereAnd(taskTable, dto, { gte: ['createdAt'], lte: ['createdAt'] })
   */
  buildWhereAnd<TTable extends PgTable, TData extends object>(
    table: TTable,
    data: TData,
    options: DrizzleWhereOptions<TTable>,
  ): DrizzleWhere {
    const conditions = this.buildWhereConditions(table, data, options)
    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * 构建 OR 查询条件
   *
   * @description 根据配置自动构建 OR 条件
   * @param table Drizzle 表对象
   * @param data 查询参数对象
   * @param options 构建配置（与 buildWhereAnd 相同）
   * @returns SQL 条件（可直接用于 where）
   */
  buildWhereOr<TTable extends PgTable, TData extends object>(
    table: TTable,
    data: TData,
    options: DrizzleWhereOptions<TTable>,
  ): DrizzleWhere {
    const conditions = this.buildWhereConditions(table, data, options)
    return conditions.length > 0 ? or(...conditions) : undefined
  }

  /**
   * 构建 NOT(AND(...)) 查询条件
   *
   * @description 根据配置自动构建 AND 条件后取反
   * @param table Drizzle 表对象
   * @param data 查询参数对象
   * @param options 构建配置（与 buildWhereAnd 相同）
   * @returns SQL 条件（可直接用于 where）
   */
  buildWhereNot<TTable extends PgTable, TData extends object>(
    table: TTable,
    data: TData,
    options: DrizzleWhereOptions<TTable>,
  ): DrizzleWhere {
    const conditions = this.buildWhereConditions(table, data, options)
    if (conditions.length === 0) {
      return undefined
    }
    const combined = and(...conditions)
    if (!combined) {
      return undefined
    }
    return not(combined)
  }

  /**
   * 构建查询条件集合
   */
  buildWhereConditions<TTable extends PgTable, TData extends object>(
    table: TTable,
    data: TData,
    options: DrizzleWhereOptions<TTable>,
  ): DrizzleSql[] {
    const conditions: DrizzleSql[] = []
    const record = data as Record<string, unknown>
    const columns = table as unknown as Record<DrizzleColumnKey<TTable>, any>
    const gteSuffix = 'Gte'
    const lteSuffix = 'Lte'
    const betweenFromSuffix = 'From'
    const betweenToSuffix = 'To'
    const escapeLikePattern = (input: string) =>
      input
        .replace(this.BACKSLASH_REGEX, '\\\\')
        .replace(this.PERCENT_REGEX, '\\%')
        .replace(this.UNDERSCORE_REGEX, '\\_')

    // 等值匹配
    for (const field of options.eq ?? []) {
      const value = record[field]
      if (value === undefined) {
        continue
      }
      if (value === null) {
        conditions.push(isNull(columns[field]))
        continue
      }
      conditions.push(eq(columns[field], value))
    }

    // 模糊匹配（ILIKE %value%）
    for (const field of options.like ?? []) {
      const value = record[field]
      if (value === undefined || value === '') {
        continue
      }
      const raw = escapeLikePattern(String(value))
      const pattern = `%${raw}%`
      conditions.push(ilike(columns[field], pattern))
    }

    // IN 查询
    for (const field of options.inArray ?? []) {
      const value = record[field]
      if (!Array.isArray(value)) {
        continue
      }
      if (value.length === 0) {
        continue
      }
      conditions.push(inArray(columns[field], value))
    }

    // 大于等于
    for (const field of options.gte ?? []) {
      const key = `${field}${gteSuffix}`
      const value = record[key]
      if (value === undefined) {
        continue
      }
      conditions.push(gte(columns[field], value))
    }

    // 小于等于
    for (const field of options.lte ?? []) {
      const key = `${field}${lteSuffix}`
      const value = record[key]
      if (value === undefined) {
        continue
      }
      conditions.push(lte(columns[field], value))
    }

    // BETWEEN
    for (const field of options.between ?? []) {
      const fromKey = `${field}${betweenFromSuffix}`
      const toKey = `${field}${betweenToSuffix}`
      const from = record[fromKey]
      const to = record[toKey]
      if (from === undefined) {
        continue
      }
      if (to === undefined) {
        continue
      }
      conditions.push(between(columns[field], from, to))
    }

    // IS NULL
    for (const field of options.isNull ?? []) {
      conditions.push(isNull(columns[field]))
    }

    return conditions
  }

  // ==================== 错误检测方法 ====================

  /**
   * 检查错误是否匹配指定的 PostgreSQL 错误码
   * @param error - 捕获的错误对象
   * @param code - PostgreSQL 错误码
   * @returns 是否匹配指定错误码
   */
  isErrorCode(error: unknown, code: string): boolean {
    const pgError = getPostgresError(error)
    return pgError !== null && pgError.code === code
  }

  /**
   * 检查是否为唯一约束冲突
   * @param error - 捕获的错误对象
   * @returns 是否为唯一约束冲突 (错误码: 23505)
   * @example
   * try {
   *   await this.db.insert(users).values({ email: 'duplicate@example.com' })
   * } catch (error) {
   *   if (this.db.isUniqueViolation(error)) {
   *     throw new ConflictException('邮箱已被注册')
   *   }
   *   throw error
   * }
   */
  isUniqueViolation(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.UNIQUE_VIOLATION)
  }

  /**
   * 检查是否为外键约束冲突
   * @param error - 捕获的错误对象
   * @returns 是否为外键约束冲突 (错误码: 23503)
   */
  isForeignKeyViolation(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.FOREIGN_KEY_VIOLATION)
  }

  /**
   * 检查是否为非空约束冲突
   * @param error - 捕获的错误对象
   * @returns 是否为非空约束冲突 (错误码: 23502)
   */
  isNotNullViolation(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.NOT_NULL_VIOLATION)
  }

  /**
   * 检查是否为检查约束冲突
   * @param error - 捕获的错误对象
   * @returns 是否为检查约束冲突 (错误码: 23514)
   */
  isCheckViolation(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.CHECK_VIOLATION)
  }

  /**
   * 检查是否为事务序列化失败
   * @param error - 捕获的错误对象
   * @returns 是否为事务序列化失败 (错误码: 40001)
   */
  isSerializationFailure(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.SERIALIZATION_FAILURE)
  }

  // ==================== 错误处理方法 ====================

  /**
   * 从错误中提取 PostgreSQL 错误信息
   * @param error - 捕获的错误对象
   * @returns PostgreSQL 错误信息对象，如果不是 PostgreSQL 错误则返回 null
   * @example
   * const pgError = this.db.extractError(error)
   * if (pgError) {
   *   console.log('错误码:', pgError.code)
   *   console.log('错误详情:', pgError.detail)
   * }
   */
  extractError(error: unknown): PostgresError | null {
    return getPostgresError(error)
  }

  /**
   * 处理数据库错误，转换为业务异常
   * @param error - 捕获的错误对象
   * @param messages - 自定义错误消息映射
   * @param messages.duplicate - 唯一约束冲突消息
   * @param messages.foreignKey - 外键约束冲突消息
   * @param messages.notNull - 非空约束冲突消息
   * @param messages.check - 检查约束冲突消息
   * @param messages.conflict - 事务冲突消息
   * @throws 根据错误类型抛出对应的 HttpException
   * @description
   * - 优先使用自定义消息
   * - 其次使用预设的默认消息
   * - 未知错误统一转换为 500 内部服务器错误
   */
  handleError(
    error: unknown,
    messages?: {
      duplicate?: string
      foreignKey?: string
      notNull?: string
      check?: string
      conflict?: string
    },
  ): never {
    const pgError = getPostgresError(error)
    if (!pgError) {
      throw error
    }

    const { code } = pgError

    // 构建消息映射
    const messageMap: Record<string, string | undefined> = {
      [PostgresErrorCode.UNIQUE_VIOLATION]: messages?.duplicate,
      [PostgresErrorCode.FOREIGN_KEY_VIOLATION]: messages?.foreignKey,
      [PostgresErrorCode.NOT_NULL_VIOLATION]: messages?.notNull,
      [PostgresErrorCode.CHECK_VIOLATION]: messages?.check,
      [PostgresErrorCode.SERIALIZATION_FAILURE]: messages?.conflict,
    }

    // 优先使用自定义消息，其次使用默认消息
    let message = messageMap[code]
    if (!message) {
      message = PostgresDefaultMessages[code]
    }

    if (message) {
      const status = PostgresHttpStatus[code]
      if (status) {
        throw new HttpException(message, status)
      }
    }

    // 未知错误码，统一转换为通用错误，避免内部细节外泄
    throw new InternalServerErrorException('数据库操作失败')
  }

  // ==================== 结果断言方法 ====================

  /**
   * 断言数组非空，如果为空则抛出 NotFoundException
   * @typeParam T - 数组元素类型
   * @param arr - 要检查的数组
   * @param message - 错误消息
   * @throws NotFoundException 当数组为空时
   * @returns 非空的数组（类型收窄为 T[]）
   * @example
   * const [user] = this.db.assertNotEmpty(
   *   await this.db.select().from(users).where(eq(users.id, id)),
   *   '用户不存在'
   * )
   */
  assertNotEmpty<T>(arr: T[], message = '记录不存在'): T[] {
    if (arr.length === 0) {
      throw new NotFoundException(message)
    }
    return arr
  }

  /**
   * 检查更新/删除操作是否影响了行，未影响则抛出 NotFoundException
   * @param result - Drizzle UPDATE/DELETE 的返回结果
   * @param message - 错误消息
   * @throws NotFoundException 当 rowCount 为 0 或数组为空时
   * @example
   * const result = await this.db.update(users).set(data).where(eq(users.id, id))
   * this.db.assertAffectedRows(result, '用户不存在')
   */
  assertAffectedRows(
    result: { rowCount?: number | null } | unknown[],
    message = '记录不存在',
  ): void {
    if (Array.isArray(result)) {
      if (result.length === 0) {
        throw new NotFoundException(message)
      }
      return
    }

    if (result?.rowCount === 0) {
      throw new NotFoundException(message)
    }
  }

  // ==================== 事务与错误包裹方法 ====================

  /**
   * 包裹数据库操作，自动处理错误并转换为业务异常
   * @typeParam T - 操作返回值类型
   * @param fn - 要执行的数据库操作函数
   * @param messages - 自定义错误消息映射
   * @param messages.duplicate - 唯一约束冲突消息
   * @param messages.foreignKey - 外键约束冲突消息
   * @param messages.notNull - 非空约束冲突消息
   * @param messages.check - 检查约束冲突消息
   * @param messages.conflict - 事务冲突消息
   * @returns 操作结果
   * @example
   * const user = await this.db.withErrorHandling(
   *   () => this.db.insert(users).values(data).returning(),
   *   { duplicate: '用户名已存在' }
   * )
   */
  async withErrorHandling<T>(
    fn: () => Promise<T>,
    messages?: {
      duplicate?: string
      foreignKey?: string
      notNull?: string
      check?: string
      conflict?: string
    },
  ): Promise<T> {
    return this.executeWithErrorHandling(fn, messages)
  }

  /**
   * 包裹数据库事务，自动处理错误并转换为业务异常
   * @typeParam T - 事务返回值类型
   * @param fn - 事务操作函数，接收事务对象作为参数
   * @param messages - 自定义错误消息映射
   * @param messages.duplicate - 唯一约束冲突消息
   * @param messages.foreignKey - 外键约束冲突消息
   * @param messages.notNull - 非空约束冲突消息
   * @param messages.check - 检查约束冲突消息
   * @param messages.conflict - 事务冲突消息
   * @returns 事务结果
   * @example
   * const result = await this.db.withTransaction(
   *   async (tx) => {
   *     const user = await tx.insert(users).values(data).returning()
   *     await tx.insert(profiles).values({ userId: user[0].id })
   *     return user
   *   },
   *   { duplicate: '用户名已存在' }
   * )
   */
  async withTransaction<T>(
    fn: (tx: Db) => Promise<T>,
    messages?: {
      duplicate?: string
      foreignKey?: string
      notNull?: string
      check?: string
      conflict?: string
    },
  ): Promise<T> {
    return this.executeWithErrorHandling(
      async () => this.db.transaction(fn),
      messages,
    )
  }

  // ==================== 私有方法 ====================

  /**
   * 执行操作并处理错误的内部实现
   * @typeParam T - 操作返回值类型
   * @param fn - 要执行的操作函数
   * @param messages - 自定义错误消息映射
   * @param messages.duplicate - 唯一约束冲突消息
   * @param messages.foreignKey - 外键约束冲突消息
   * @param messages.notNull - 非空约束冲突消息
   * @param messages.check - 检查约束冲突消息
   * @param messages.conflict - 事务冲突消息
   * @returns 操作结果
   */
  private async executeWithErrorHandling<T>(
    fn: () => Promise<T>,
    messages?: {
      duplicate?: string
      foreignKey?: string
      notNull?: string
      check?: string
      conflict?: string
    },
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      this.handleError(error, messages)
    }
  }
}
