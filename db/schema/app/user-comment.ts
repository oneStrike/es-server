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
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 用户评论表
 * 统一存储作品评论、章节评论和论坛回复
 */
export const userComment = snakeCase.table(
  'user_comment',
  {
    /**
     * 主键ID
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 目标类型（1=漫画，2=小说，3=漫画章节，4=小说章节，5=论坛主题）
     */
    targetType: smallint().notNull(),
    /**
     * 目标ID
     */
    targetId: integer().notNull(),
    /**
     * 评论用户ID
     */
    userId: integer().notNull(),
    /**
     * 评论正文 HTML。
     * 对外唯一正文表示，纯文本编辑器也需输出最小 HTML。
     */
    html: text().notNull(),
    /**
     * 评论纯文本派生列。
     * 供搜索、摘录和审核链路复用，不再表示客户端原始输入。
     */
    content: text().notNull(),
    /**
     * canonical 正文文档。
     * 评论正文的唯一真相源；运行时不再依赖原始 content 作为输入来源。
     */
    body: jsonb().notNull(),
    /**
     * 正文版本（1=v1）。
     */
    bodyVersion: smallint().default(1).notNull(),
    /**
     * 楼层号
     */
    floor: integer(),
    /**
     * 回复目标评论ID
     */
    replyToId: integer(),
    /**
     * 实际回复的根评论ID
     */
    actualReplyToId: integer(),
    /**
     * 是否隐藏
     */
    isHidden: boolean().default(false).notNull(),
    /**
     * 审核状态（0=待审核，1=通过，2=拒绝）
     */
    auditStatus: smallint().default(0).notNull(),
    /**
     * 审核人ID
     */
    auditById: integer(),
    /**
     * 审核角色（0=版主，1=管理员）
     */
    auditRole: smallint(),
    /**
     * 审核原因
     */
    auditReason: varchar({ length: 500 }),
    /**
     * 审核时间
     */
    auditAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 点赞数
     */
    likeCount: integer().default(0).notNull(),
    /**
     * 敏感词命中记录
     */
    sensitiveWordHits: jsonb(),
    /**
     * 评论提交时解析到的国家/地区
     * 仅记录新写入评论的属地快照，无法解析或历史记录时为空
     */
    geoCountry: varchar({ length: 100 }),
    /**
     * 评论提交时解析到的省份/州
     * 仅记录新写入评论的属地快照，无法解析或历史记录时为空
     */
    geoProvince: varchar({ length: 100 }),
    /**
     * 评论提交时解析到的城市
     * 仅记录新写入评论的属地快照，无法解析或历史记录时为空
     */
    geoCity: varchar({ length: 100 }),
    /**
     * 评论提交时解析到的网络运营商
     * 仅记录新写入评论的属地快照，无法解析或历史记录时为空
     */
    geoIsp: varchar({ length: 100 }),
    /**
     * 属地解析来源
     * 当前固定为 ip2region；历史记录或未补齐属地快照时为空
     */
    geoSource: varchar({ length: 50 }),
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
    /**
     * 删除时间（软删除）
     */
    deletedAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 保留截止时间；可见评论不会被硬删除清理。
     */
    retentionUntil: timestamp({ withTimezone: true, precision: 6 }).default(
      sql`now() + interval '365 days'`,
    ),
    /**
     * 归档时间；为空表示仍处于热数据窗口。
     */
    archivedAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 主题删除级联批次。
     * 仅论坛主题删除链路写入；恢复时只复活匹配批次的评论，避免误恢复独立删除的评论。
     */
    topicDeleteCascadeId: varchar({ length: 80 }),
  },
  (table) => [
    /**
     * 目标维度时间索引
     */
    index('user_comment_target_type_target_id_created_at_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    /**
     * 楼层查询索引
     */
    index('user_comment_target_type_target_id_reply_to_id_floor_idx').on(
      table.targetType,
      table.targetId,
      table.replyToId,
      table.floor,
    ),
    index('user_comment_target_root_floor_id_idx')
      .on(table.targetType, table.targetId, table.floor, table.id)
      .where(
        sql`${table.replyToId} is null and ${table.auditStatus} = 1 and ${table.isHidden} = false and ${table.deletedAt} is null`,
      ),
    index('user_comment_target_visible_created_id_idx')
      .on(
        table.targetType,
        table.targetId,
        table.createdAt.desc(),
        table.id.desc(),
      )
      .where(
        sql`${table.auditStatus} = 1 and ${table.isHidden} = false and ${table.deletedAt} is null`,
      ),
    index('user_comment_target_visible_like_id_idx')
      .on(
        table.targetType,
        table.targetId,
        table.likeCount.desc(),
        table.createdAt.desc(),
        table.id.desc(),
      )
      .where(
        sql`${table.auditStatus} = 1 and ${table.isHidden} = false and ${table.deletedAt} is null`,
      ),
    index('user_comment_retention_until_id_idx').on(
      table.retentionUntil,
      table.id,
    ),
    /**
     * 根评论楼层唯一约束。
     * 楼层号由 user_comment_floor_counter 事务性分配，不再通过 max(floor)+1 推导。
     */
    uniqueIndex('user_comment_root_floor_live_key')
      .on(table.targetType, table.targetId, table.floor)
      .where(sql`${table.replyToId} is null and ${table.deletedAt} is null`),
    /**
     * 可见评论索引
     * 注意：PostgreSQL 索引名最大 63 字符，此名称已被自动截断
     */
    index('user_comment_target_type_target_id_audit_status_is_hidden_d_idx').on(
      table.targetType,
      table.targetId,
      table.auditStatus,
      table.isHidden,
      table.deletedAt,
    ),
    /**
     * 回复分页索引
     * 注意：PostgreSQL 索引名最大 63 字符，此名称已被自动截断
     */
    index('user_comment_actual_reply_to_id_audit_status_is_hidden_dele_idx').on(
      table.actualReplyToId,
      table.auditStatus,
      table.isHidden,
      table.deletedAt,
      table.createdAt,
    ),
    /**
     * 目标删除时间索引
     */
    index('user_comment_target_type_target_id_deleted_at_created_at_idx').on(
      table.targetType,
      table.targetId,
      table.deletedAt,
      table.createdAt,
    ),
    /**
     * 用户索引
     */
    index('user_comment_user_id_idx').on(table.userId),
    /**
     * 用户最近评论索引
     * 支持用户维度最新评论查询与发言频控。
     */
    index('user_comment_user_id_created_at_desc_idx').on(
      table.userId,
      table.createdAt.desc(),
    ),
    /**
     * 用户有效评论时间索引
     * 兼顾我的评论分页与按删除状态过滤后的时间倒序查询。
     */
    index('user_comment_user_id_deleted_at_created_at_desc_idx').on(
      table.userId,
      table.deletedAt,
      table.createdAt.desc(),
    ),
    /**
     * 创建时间索引
     */
    index('user_comment_created_at_idx').on(table.createdAt),
    /**
     * 管理端评论列表默认分页索引。
     * 支持 deleted_at 过滤后的创建时间倒序与 id 稳定分页。
     */
    index('user_comment_admin_live_created_id_idx')
      .on(table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    /**
     * 管理端评论列表按用户筛选索引。
     */
    index('user_comment_admin_live_user_created_id_idx')
      .on(table.userId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    /**
     * 管理端评论列表按审核状态筛选索引。
     */
    index('user_comment_admin_live_audit_created_id_idx')
      .on(table.auditStatus, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    /**
     * 审核状态索引
     */
    index('user_comment_audit_status_idx').on(table.auditStatus),
    /**
     * 隐藏状态索引
     */
    index('user_comment_is_hidden_idx').on(table.isHidden),
    /**
     * 回复目标索引
     */
    index('user_comment_reply_to_id_idx').on(table.replyToId),
    /**
     * 实际回复目标索引
     */
    index('user_comment_actual_reply_to_id_idx').on(table.actualReplyToId),
    /**
     * 删除时间索引
     */
    index('user_comment_deleted_at_idx').on(table.deletedAt),
    /**
     * 论坛主题删除恢复批次索引。
     */
    index('user_comment_topic_delete_cascade_id_idx').on(
      table.topicDeleteCascadeId,
    ),
    index('user_comment_forum_topic_restore_batch_idx')
      .on(table.targetId, table.topicDeleteCascadeId, table.deletedAt)
      .where(
        sql`${table.targetType} = 5 and ${table.topicDeleteCascadeId} is not null`,
      ),
    /**
     * 正文版本索引
     */
    index('user_comment_body_version_idx').on(table.bodyVersion),
    /**
     * 论坛主题可见评论重算索引：支持 commentCount 与最后评论查询。
     */
    index('user_comment_forum_topic_visible_latest_idx')
      .on(table.targetId, table.createdAt.desc(), table.id.desc())
      .where(
        sql`${table.targetType} = 5 and ${table.auditStatus} = 1 and ${table.isHidden} = false and ${table.deletedAt} is null`,
      ),
    /**
     * 删除论坛主题时的评论用户聚合索引：按 topicId/userId 统计未删除评论。
     */
    index('user_comment_forum_topic_live_user_agg_idx')
      .on(table.targetId, table.userId)
      .where(sql`${table.targetType} = 5 and ${table.deletedAt} is null`),
    /**
     * 论坛评论正文搜索索引：保留现有 ILIKE 包含匹配语义，依赖 pg_trgm。
     */
    index('user_comment_forum_topic_content_trgm_idx')
      .using('gin', table.content.op('gin_trgm_ops'))
      .where(sql`${table.targetType} = 5 and ${table.deletedAt} is null`),
    /**
     * 正文版本闭集约束
     */
    check(
      'user_comment_body_version_valid_chk',
      sql`${table.bodyVersion} in (1)`,
    ),
    /**
     * 多态评论目标必须属于注册表的闭集；零外键模型下由写入事务按该类型
     * 锁定并重查对应父记录。
     */
    check(
      'user_comment_target_type_valid_chk',
      sql`${table.targetType} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'user_comment_audit_role_valid_chk',
      sql`${table.auditRole} is null or ${table.auditRole} in (0, 1)`,
    ),
    check(
      'user_comment_audit_actor_pair_chk',
      sql`(${table.auditRole} is null) = (${table.auditById} is null)`,
    ),
    check(
      'user_comment_like_count_non_negative_chk',
      sql`${table.likeCount} >= 0`,
    ),
    check(
      'user_comment_root_floor_required_chk',
      sql`${table.replyToId} is not null or ${table.floor} is not null`,
    ),
  ],
)

export type UserCommentSelect = typeof userComment.$inferSelect
export type UserCommentInsert = typeof userComment.$inferInsert
