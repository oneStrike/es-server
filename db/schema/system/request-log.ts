/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 请求日志
 */
export const requestLog = snakeCase.table(
  'sys_request_log',
  {
    /**
     * 主键id
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 用户ID（可空）
     */
    userId: integer(),
    /**
     * 用户名（可空）
     */
    username: text(),
    /**
     * 接口类型（1=管理端，2=应用端，3=系统端，4=公共端）
     */
    apiType: smallint(),
    /**
     * 请求方法（GET/POST等）
     */
    method: varchar({ length: 10 }).notNull(),
    /**
     * 请求路径
     */
    path: varchar({ length: 255 }).notNull(),
    /**
     * 请求参数（JSON格式）
     */
    params: jsonb(),
    /**
     * IP地址（自动获取）
     */
    ip: varchar({ length: 45 }),
    /**
     * 设备信息（User-Agent 原始字符串）
     */
    userAgent: varchar({ length: 255 }),
    /**
     * 设备信息（User-Agent 解析结果，JSON）
     */
    device: jsonb(),
    /**
     * 请求发起时解析到的国家/地区
     * 仅记录新写入请求日志的属地快照，无法解析或历史记录时为空
     */
    geoCountry: varchar({ length: 100 }),
    /**
     * 请求发起时解析到的省份/州
     * 仅记录新写入请求日志的属地快照，无法解析或历史记录时为空
     */
    geoProvince: varchar({ length: 100 }),
    /**
     * 请求发起时解析到的城市
     * 仅记录新写入请求日志的属地快照，无法解析或历史记录时为空
     */
    geoCity: varchar({ length: 100 }),
    /**
     * 请求发起时解析到的网络运营商
     * 仅记录新写入请求日志的属地快照，无法解析或历史记录时为空
     */
    geoIsp: varchar({ length: 100 }),
    /**
     * 属地解析来源
     * 当前固定为 ip2region；历史记录或未补齐属地快照时为空
     */
    geoSource: varchar({ length: 50 }),
    /**
     * 操作类型（1=登录，2=登出，3=创建，4=更新，5=删除，6=上传，7=下载，8=导出，9=导入）
     */
    actionType: smallint(),
    /**
     * 操作结果
     */
    isSuccess: boolean().notNull(),
    /**
     * 自定义日志内容（必填）
     */
    content: text().notNull(),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 更新时间
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * 创建时间索引
     */
    index('sys_request_log_created_at_idx').on(table.createdAt),
    /**
     * 用户ID索引
     */
    index('sys_request_log_user_id_idx').on(table.userId),
    /**
     * 用户名索引
     */
    index('sys_request_log_username_idx').on(table.username),
    /**
     * 请求结果索引
     */
    index('sys_request_log_is_success_idx').on(table.isSuccess),
    check(
      'sys_request_log_api_type_valid_chk',
      sql`${table.apiType} is null or ${table.apiType} in (1, 2, 3, 4)`,
    ),
    check(
      'sys_request_log_action_type_valid_chk',
      sql`${table.actionType} is null or ${table.actionType} in (1, 2, 3, 4, 5, 6, 7, 8, 9)`,
    ),
  ],
)
