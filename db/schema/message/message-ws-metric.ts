/**
 * Auto-converted from legacy schema.
 */

import { bigint, index, integer, pgTable, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * WebSocket 监控分钟聚合表
 */
export const messageWsMetric = pgTable("message_ws_metric", {
  /**
   * 主键ID
   */
  id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 统计桶时间（按分钟截断）
   */
  bucketAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
  /**
   * WS 请求总数
   */
  requestCount: integer().default(0).notNull(),
  /**
   * ack 成功数量（code=0）
   */
  ackSuccessCount: integer().default(0).notNull(),
  /**
   * ack 失败数量（code!=0）
   */
  ackErrorCount: integer().default(0).notNull(),
  /**
   * ack 延迟累积毫秒
   */
  ackLatencyTotalMs: bigint({ mode: "bigint" }).default(0n).notNull(),
  /**
   * 连接/重连次数
   */
  reconnectCount: integer().default(0).notNull(),
  /**
   * 补偿触发次数（afterSeq 查询触发）
   */
  resyncTriggerCount: integer().default(0).notNull(),
  /**
   * 补偿成功次数（afterSeq 查询成功返回）
   */
  resyncSuccessCount: integer().default(0).notNull(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
    /**
     * 唯一索引: bucketAt
     */
    unique("message_ws_metric_bucket_at_key").on(table.bucketAt),
    /**
     * 索引: bucketAt
     */
    index("message_ws_metric_bucket_at_idx").on(table.bucketAt),
]);
