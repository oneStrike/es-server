import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  smallint,
  snakeCase,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 系统公告表 - 存储平台公告、活动公告、维护公告等信息
 */
export const appAnnouncement = snakeCase.table(
  'app_announcement',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 关联的页面ID（可选）
     */
    pageId: integer(),
    /**
     * 公告标题
     */
    title: varchar({ length: 100 }).notNull(),
    /**
     * 公告内容
     */
    content: text().notNull(),
    /**
     * 公告摘要
     */
    summary: varchar({ length: 500 }),
    /**
     * 公告类型（0=平台公告, 1=活动公告, 2=维护公告, 3=更新公告, 4=政策公告）
     */
    announcementType: smallint().default(0).notNull(),
    /**
     * 优先级（0=低优先级，1=中优先级，2=高优先级，3=紧急）
     */
    priorityLevel: smallint().default(1).notNull(),
    /**
     * 是否已发布
     */
    isPublished: boolean().default(false).notNull(),
    /**
     * 是否实时公告，开启后在发布窗口内同步到消息中心
     */
    isRealtime: boolean().default(false).notNull(),
    /**
     * 是否置顶
     */
    isPinned: boolean().default(false).notNull(),
    /**
     * 是否以弹窗形式显示
     */
    showAsPopup: boolean().default(false).notNull(),
    /**
     * 弹窗背景图片URL
     */
    popupBackgroundImage: varchar({ length: 200 }),
    /**
     * 弹窗背景图片位置（CSS background-position 值，支持多方位定位）
     * 默认值为 center（居中）
     */
    popupBackgroundPosition: varchar({ length: 20 })
      .default('center')
      .notNull(),
    /**
     * 启用的平台列表（1=H5, 2=App, 3=小程序；默认值为全部平台）
     */
    enablePlatform: smallint()
      .array()
      .default(sql`ARRAY[1,2,3]::smallint[]`)
      .notNull(),
    /**
     * 发布开始时间
     */
    publishStartTime: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 发布结束时间
     */
    publishEndTime: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 最近已入队的消息中心开始边界时间
     */
    notificationStartBoundaryAt: timestamp({
      withTimezone: true,
      precision: 6,
    }),
    /**
     * 最近已入队的消息中心结束边界时间
     */
    notificationEndBoundaryAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 当前消息中心扇出任务 ID
     */
    notificationFanoutTaskId: integer(),
    /**
     * 当前消息中心扇出目标事件键
     */
    notificationFanoutDesiredEventKey: varchar({ length: 120 }),
    /**
     * 当前消息中心扇出任务状态（0=待处理，1=处理中，2=成功，3=失败）
     */
    notificationFanoutStatus: smallint(),
    /**
     * 当前消息中心扇出错误信息
     */
    notificationFanoutLastError: varchar({ length: 500 }),
    /**
     * 当前消息中心扇出更新时间
     */
    notificationFanoutUpdatedAt: timestamp({
      withTimezone: true,
      precision: 6,
    }),
    /**
     * 浏览次数
     */
    viewCount: integer().default(0).notNull(),
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
     * 发布状态与发布时间索引
     * 注意：PostgreSQL 索引名最大 63 字符，此名称已被自动截断
     */
    index('app_announcement_is_published_publish_start_time_publish_en_idx').on(
      table.isPublished,
      table.publishStartTime,
      table.publishEndTime,
    ),
    /**
     * APP 公开可见窗口索引
     */
    index('app_announcement_app_visible_window_idx').on(
      table.isPublished,
      table.publishStartTime,
      table.publishEndTime,
      table.isPinned.desc(),
      table.id.desc(),
    ),
    /**
     * 启用平台数组 GIN 索引
     */
    index('app_announcement_enable_platform_gin_idx').using(
      'gin',
      table.enablePlatform,
    ),
    /**
     * 类型与发布状态索引
     */
    index('app_announcement_announcement_type_is_published_idx').on(
      table.announcementType,
      table.isPublished,
    ),
    /**
     * 实时公告与发布状态索引
     */
    index('app_announcement_is_realtime_is_published_idx').on(
      table.isRealtime,
      table.isPublished,
    ),
    /**
     * 实时公告开始生命周期扫描索引
     */
    index('app_announcement_realtime_publish_start_pending_idx')
      .on(table.publishStartTime, table.id)
      .where(
        sql`${table.isRealtime} = true and ${table.isPublished} = true and ${table.enablePlatform} && ARRAY[2]::smallint[] and ${table.publishStartTime} is not null and ${table.notificationStartBoundaryAt} is distinct from ${table.publishStartTime}`,
      ),
    /**
     * 实时公告结束生命周期扫描索引
     */
    index('app_announcement_realtime_publish_end_pending_idx')
      .on(table.publishEndTime, table.id)
      .where(
        sql`${table.isRealtime} = true and ${table.isPublished} = true and ${table.enablePlatform} && ARRAY[2]::smallint[] and ${table.publishEndTime} is not null and ${table.notificationEndBoundaryAt} is distinct from ${table.publishEndTime}`,
      ),
    /**
     * 管理端消息中心扇出状态筛选索引
     */
    index('app_announcement_notification_fanout_status_idx').on(
      table.notificationFanoutStatus,
      table.notificationFanoutUpdatedAt.desc(),
      table.id.desc(),
    ),
    /**
     * 优先级与置顶索引
     */
    index('app_announcement_priority_level_is_pinned_idx').on(
      table.priorityLevel,
      table.isPinned,
    ),
    /**
     * 创建时间索引
     */
    index('app_announcement_created_at_idx').on(table.createdAt),
    /**
     * 页面索引
     */
    index('app_announcement_page_id_idx').on(table.pageId),
    /**
     * 弹窗与发布状态索引
     */
    index('app_announcement_show_as_popup_is_published_idx').on(
      table.showAsPopup,
      table.isPublished,
    ),
    check(
      'app_announcement_type_valid_chk',
      sql`${table.announcementType} in (0, 1, 2, 3, 4)`,
    ),
    check(
      'app_announcement_priority_level_valid_chk',
      sql`${table.priorityLevel} in (0, 1, 2, 3)`,
    ),
    check(
      'app_announcement_enable_platform_valid_chk',
      sql`${table.enablePlatform} <@ ARRAY[1,2,3]::smallint[] and cardinality(${table.enablePlatform}) > 0`,
    ),
    check(
      'app_announcement_publish_window_valid_chk',
      sql`${table.publishStartTime} is null or ${table.publishEndTime} is null or ${table.publishStartTime} < ${table.publishEndTime}`,
    ),
    check(
      'app_announcement_popup_position_valid_chk',
      sql`${table.popupBackgroundPosition} in ('center', 'top center', 'top left', 'top right', 'bottom center', 'bottom left', 'bottom right', 'left center', 'right center')`,
    ),
    check(
      'app_announcement_view_count_non_negative_chk',
      sql`${table.viewCount} >= 0`,
    ),
    check(
      'app_announcement_notification_fanout_status_valid_chk',
      sql`${table.notificationFanoutStatus} is null or ${table.notificationFanoutStatus} in (0, 1, 2, 3)`,
    ),
  ],
)

export type AppAnnouncementSelect = typeof appAnnouncement.$inferSelect
export type AppAnnouncementInsert = typeof appAnnouncement.$inferInsert
