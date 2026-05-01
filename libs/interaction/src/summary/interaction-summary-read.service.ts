import type {
  CommentWorkTargetTypePair,
  InteractionActorSummaryMap,
  InteractionAppUserSummaryMap,
  InteractionAuditorSummaryKey,
  InteractionCommentTargetSummaryMap,
  InteractionReplyCommentSummaryMap,
  InteractionReportCommentSummaryMap,
  InteractionReportTargetSummaryMap,
  InteractionSceneSummaryKey,
  InteractionSceneSummaryMap,
  InteractionSummaryQueryOptions,
  InteractionTargetSummaryKey,
  ReportWorkTargetTypePair,
} from './interaction-summary.type'
import { DrizzleService } from '@db/core'
import { AdminUserRoleEnum } from '@libs/identity/admin-user.constant'
import {
  AuditRoleEnum,
  AuditStatusEnum,
  CommentLevelEnum,
  SceneTypeEnum,
} from '@libs/platform/constant'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import { CommentTargetTypeEnum } from '../comment/comment.constant'
import { ReportTargetTypeEnum } from '../report/report.constant'

/**
 * 交互域展示摘要只读服务。
 * 统一批量装配评论、举报列表和详情所需的多态目标、场景与参与人摘要。
 */
@Injectable()
export class InteractionSummaryReadService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 获取 Drizzle 查询客户端。
  private get db() {
    return this.drizzle.db
  }

  // 获取作品表定义。
  private get work() {
    return this.drizzle.schema.work
  }

  // 获取章节表定义。
  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 获取论坛主题表定义。
  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  // 获取论坛板块表定义。
  private get forumSection() {
    return this.drizzle.schema.forumSection
  }

  // 获取用户评论表定义。
  private get userComment() {
    return this.drizzle.schema.userComment
  }

  // 获取应用用户表定义。
  private get appUser() {
    return this.drizzle.schema.appUser
  }

  // 获取后台管理员表定义。
  private get adminUser() {
    return this.drizzle.schema.adminUser
  }

  // 构建多态目标摘要 map key，避免不同类型下相同 ID 相互覆盖。
  buildTargetSummaryKey(target: InteractionTargetSummaryKey) {
    return `${target.targetType}:${target.targetId}`
  }

  // 构建业务场景摘要 map key，避免不同场景类型下相同 ID 相互覆盖。
  buildSceneSummaryKey(scene: InteractionSceneSummaryKey) {
    return `${scene.sceneType}:${scene.sceneId}`
  }

  // 构建管理员摘要 map key，和版主来源区分开。
  buildAdminActorSummaryKey(actorId: number) {
    return `admin:${actorId}`
  }

  // 构建审核人摘要 map key，审核角色缺失时按管理员来源兜底。
  buildAuditorSummaryKey(auditor: InteractionAuditorSummaryKey) {
    if (!auditor.auditById) {
      return undefined
    }

    return auditor.auditRole === AuditRoleEnum.MODERATOR
      ? `moderator:${auditor.auditById}`
      : this.buildAdminActorSummaryKey(auditor.auditById)
  }

  // 批量查询评论目标摘要。
  async getCommentTargetSummaryMap(
    targets: InteractionTargetSummaryKey[],
    options: InteractionSummaryQueryOptions = {},
  ) {
    const summaryMap: InteractionCommentTargetSummaryMap = new Map()
    await this.appendCommentWorkTargetSummaries(summaryMap, targets, {
      targetType: CommentTargetTypeEnum.COMIC,
      workType: 1,
    })
    await this.appendCommentWorkTargetSummaries(summaryMap, targets, {
      targetType: CommentTargetTypeEnum.NOVEL,
      workType: 2,
    })
    await this.appendCommentChapterTargetSummaries(summaryMap, targets, {
      targetType: CommentTargetTypeEnum.COMIC_CHAPTER,
      workType: 1,
    })
    await this.appendCommentChapterTargetSummaries(summaryMap, targets, {
      targetType: CommentTargetTypeEnum.NOVEL_CHAPTER,
      workType: 2,
    })
    await this.appendCommentForumTopicTargetSummaries(
      summaryMap,
      targets,
      options,
    )
    return summaryMap
  }

  // 批量查询举报目标摘要。
  async getReportTargetSummaryMap(
    targets: InteractionTargetSummaryKey[],
    options: InteractionSummaryQueryOptions = {},
  ) {
    const summaryMap: InteractionReportTargetSummaryMap = new Map()
    await this.appendReportWorkTargetSummaries(summaryMap, targets, {
      targetType: ReportTargetTypeEnum.COMIC,
      workType: 1,
    })
    await this.appendReportWorkTargetSummaries(summaryMap, targets, {
      targetType: ReportTargetTypeEnum.NOVEL,
      workType: 2,
    })
    await this.appendReportChapterTargetSummaries(summaryMap, targets, {
      targetType: ReportTargetTypeEnum.COMIC_CHAPTER,
      workType: 1,
    })
    await this.appendReportChapterTargetSummaries(summaryMap, targets, {
      targetType: ReportTargetTypeEnum.NOVEL_CHAPTER,
      workType: 2,
    })
    await this.appendReportForumTopicTargetSummaries(
      summaryMap,
      targets,
      options,
    )
    await this.appendReportCommentTargetSummaries(summaryMap, targets, options)
    await this.appendReportUserTargetSummaries(summaryMap, targets)
    return summaryMap
  }

  // 批量查询举报业务场景摘要。
  async getSceneSummaryMap(scenes: InteractionSceneSummaryKey[]) {
    const summaryMap: InteractionSceneSummaryMap = new Map()
    await this.appendWorkSceneSummaries(
      summaryMap,
      scenes,
      SceneTypeEnum.COMIC_WORK,
      1,
    )
    await this.appendWorkSceneSummaries(
      summaryMap,
      scenes,
      SceneTypeEnum.NOVEL_WORK,
      2,
    )
    await this.appendChapterSceneSummaries(
      summaryMap,
      scenes,
      SceneTypeEnum.COMIC_CHAPTER,
      1,
    )
    await this.appendChapterSceneSummaries(
      summaryMap,
      scenes,
      SceneTypeEnum.NOVEL_CHAPTER,
      2,
    )
    await this.appendForumTopicSceneSummaries(summaryMap, scenes)
    await this.appendUserProfileSceneSummaries(summaryMap, scenes)
    return summaryMap
  }

  // 批量查询应用用户摘要。
  async getAppUserSummaryMap(userIds: Array<number | null | undefined>) {
    const uniqueUserIds = this.uniquePositiveIds(userIds)
    const summaryMap: InteractionAppUserSummaryMap = new Map()
    if (uniqueUserIds.length === 0) {
      return summaryMap
    }

    const users = await this.db
      .select({
        id: this.appUser.id,
        nickname: this.appUser.nickname,
        avatarUrl: this.appUser.avatarUrl,
        status: this.appUser.status,
        isEnabled: this.appUser.isEnabled,
      })
      .from(this.appUser)
      .where(inArray(this.appUser.id, uniqueUserIds))

    for (const user of users) {
      summaryMap.set(user.id, user)
    }

    return summaryMap
  }

  // 批量查询管理员或处理人摘要。
  async getAdminActorSummaryMap(adminIds: Array<number | null | undefined>) {
    const uniqueAdminIds = this.uniquePositiveIds(adminIds)
    const summaryMap: InteractionActorSummaryMap = new Map()
    if (uniqueAdminIds.length === 0) {
      return summaryMap
    }

    const admins = await this.db
      .select({
        id: this.adminUser.id,
        username: this.adminUser.username,
        avatar: this.adminUser.avatar,
        role: this.adminUser.role,
      })
      .from(this.adminUser)
      .where(inArray(this.adminUser.id, uniqueAdminIds))

    for (const admin of admins) {
      summaryMap.set(this.buildAdminActorSummaryKey(admin.id), {
        id: admin.id,
        username: admin.username,
        nickname: admin.username,
        avatar: admin.avatar ?? undefined,
        roleName: this.getAdminUserRoleName(admin.role as AdminUserRoleEnum),
      })
    }

    return summaryMap
  }

  // 批量查询审核人摘要，按审核角色区分管理员和版主。
  async getAuditorSummaryMap(auditors: InteractionAuditorSummaryKey[]) {
    const summaryMap: InteractionActorSummaryMap = new Map()
    const adminIds = auditors
      .filter(
        (item) =>
          typeof item.auditById === 'number' &&
          item.auditRole !== AuditRoleEnum.MODERATOR,
      )
      .map((item) => item.auditById)
    const moderatorIds = auditors
      .filter(
        (item) =>
          typeof item.auditById === 'number' &&
          item.auditRole === AuditRoleEnum.MODERATOR,
      )
      .map((item) => item.auditById)

    const [adminMap, moderatorMap] = await Promise.all([
      this.getAdminActorSummaryMap(adminIds),
      this.getAppUserSummaryMap(moderatorIds),
    ])

    for (const [key, value] of adminMap) {
      summaryMap.set(key, value)
    }

    for (const [moderatorId, user] of moderatorMap) {
      summaryMap.set(`moderator:${moderatorId}`, {
        id: user.id,
        username: user.nickname,
        nickname: user.nickname,
        avatar: user.avatarUrl ?? undefined,
        roleName: '版主',
      })
    }

    return summaryMap
  }

  // 批量查询被回复评论摘要。
  async getReplyCommentSummaryMap(
    commentIds: Array<number | null | undefined>,
  ) {
    const uniqueCommentIds = this.uniquePositiveIds(commentIds)
    const summaryMap: InteractionReplyCommentSummaryMap = new Map()
    if (uniqueCommentIds.length === 0) {
      return summaryMap
    }

    const comments = await this.db
      .select({
        id: this.userComment.id,
        userId: this.userComment.userId,
        content: this.userComment.content,
        auditStatus: this.userComment.auditStatus,
        isHidden: this.userComment.isHidden,
      })
      .from(this.userComment)
      .where(inArray(this.userComment.id, uniqueCommentIds))

    const userMap = await this.getAppUserSummaryMap(
      comments.map((item) => item.userId),
    )

    for (const comment of comments) {
      const user = userMap.get(comment.userId)
      summaryMap.set(comment.id, {
        commentId: comment.id,
        contentExcerpt: this.toExcerpt(comment.content),
        userNickname: user?.nickname,
        userAvatarUrl: user?.avatarUrl,
        userStatus: user?.status,
        userIsEnabled: user?.isEnabled,
        auditStatus: comment.auditStatus as AuditStatusEnum,
        isHidden: comment.isHidden,
      })
    }

    return summaryMap
  }

  // 批量查询被举报评论摘要。
  async getReportCommentSummaryMap(
    commentIds: Array<number | null | undefined>,
  ) {
    const uniqueCommentIds = this.uniquePositiveIds(commentIds)
    const summaryMap: InteractionReportCommentSummaryMap = new Map()
    if (uniqueCommentIds.length === 0) {
      return summaryMap
    }

    const comments = await this.db
      .select({
        id: this.userComment.id,
        userId: this.userComment.userId,
        content: this.userComment.content,
        replyToId: this.userComment.replyToId,
        auditStatus: this.userComment.auditStatus,
        isHidden: this.userComment.isHidden,
      })
      .from(this.userComment)
      .where(inArray(this.userComment.id, uniqueCommentIds))

    const userMap = await this.getAppUserSummaryMap(
      comments.map((item) => item.userId),
    )

    for (const comment of comments) {
      const user = userMap.get(comment.userId)
      summaryMap.set(comment.id, {
        commentId: comment.id,
        contentExcerpt: this.toExcerpt(comment.content),
        commentLevel: comment.replyToId
          ? CommentLevelEnum.REPLY
          : CommentLevelEnum.ROOT,
        isHidden: comment.isHidden,
        auditStatus: comment.auditStatus as AuditStatusEnum,
        userNickname: user?.nickname,
        userAvatarUrl: user?.avatarUrl,
        userStatus: user?.status,
        userIsEnabled: user?.isEnabled,
      })
    }

    return summaryMap
  }

  // 获取指定目标类型对应的去重 ID 列表。
  private getTargetIdsByType(
    targets: InteractionTargetSummaryKey[],
    targetType: number,
  ) {
    return this.uniquePositiveIds(
      targets
        .filter((target) => target.targetType === targetType)
        .map((target) => target.targetId),
    )
  }

  // 获取指定场景类型对应的去重 ID 列表。
  private getSceneIdsByType(
    scenes: InteractionSceneSummaryKey[],
    sceneType: SceneTypeEnum,
  ) {
    return this.uniquePositiveIds(
      scenes
        .filter((scene) => scene.sceneType === sceneType)
        .map((scene) => scene.sceneId),
    )
  }

  // 去重并过滤非法 ID。
  private uniquePositiveIds(ids: Array<number | null | undefined>) {
    return [
      ...new Set(
        ids.filter(
          (id): id is number =>
            typeof id === 'number' && Number.isInteger(id) && id > 0,
        ),
      ),
    ]
  }

  // 生成最多 50 个字符的内容摘要。
  private toExcerpt(content?: string | null) {
    if (!content) {
      return null
    }

    return content.length > 50 ? content.slice(0, 50) : content
  }

  // 读取评论挂载的作品摘要。
  private async appendCommentWorkTargetSummaries(
    summaryMap: InteractionCommentTargetSummaryMap,
    targets: InteractionTargetSummaryKey[],
    pair: CommentWorkTargetTypePair,
  ) {
    const targetIds = this.getTargetIdsByType(targets, pair.targetType)
    if (targetIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.work.id,
        name: this.work.name,
        deletedAt: this.work.deletedAt,
      })
      .from(this.work)
      .where(
        and(
          inArray(this.work.id, targetIds),
          eq(this.work.type, pair.workType),
        ),
      )

    for (const row of rows) {
      summaryMap.set(
        this.buildTargetSummaryKey({
          targetType: pair.targetType,
          targetId: row.id,
        }),
        {
          targetId: row.id,
          targetType: pair.targetType,
          targetTypeName: this.getCommentTargetTypeName(pair.targetType),
          name: row.name,
          deletedAt: row.deletedAt,
        },
      )
    }
  }

  // 读取评论挂载的章节摘要，并补充所属作品名称。
  private async appendCommentChapterTargetSummaries(
    summaryMap: InteractionCommentTargetSummaryMap,
    targets: InteractionTargetSummaryKey[],
    pair: CommentWorkTargetTypePair,
  ) {
    const targetIds = this.getTargetIdsByType(targets, pair.targetType)
    if (targetIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.workChapter.id,
        title: this.workChapter.title,
        workName: this.work.name,
        deletedAt: this.workChapter.deletedAt,
      })
      .from(this.workChapter)
      .leftJoin(this.work, eq(this.work.id, this.workChapter.workId))
      .where(
        and(
          inArray(this.workChapter.id, targetIds),
          eq(this.workChapter.workType, pair.workType),
        ),
      )

    for (const row of rows) {
      summaryMap.set(
        this.buildTargetSummaryKey({
          targetType: pair.targetType,
          targetId: row.id,
        }),
        {
          targetId: row.id,
          targetType: pair.targetType,
          targetTypeName: this.getCommentTargetTypeName(pair.targetType),
          title: row.title,
          workName: row.workName,
          deletedAt: row.deletedAt,
        },
      )
    }
  }

  // 读取评论挂载的论坛主题摘要。
  private async appendCommentForumTopicTargetSummaries(
    summaryMap: InteractionCommentTargetSummaryMap,
    targets: InteractionTargetSummaryKey[],
    options: InteractionSummaryQueryOptions,
  ) {
    const targetIds = this.getTargetIdsByType(
      targets,
      CommentTargetTypeEnum.FORUM_TOPIC,
    )
    if (targetIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.forumTopic.id,
        title: this.forumTopic.title,
        isHidden: this.forumTopic.isHidden,
        auditStatus: this.forumTopic.auditStatus,
        deletedAt: this.forumTopic.deletedAt,
        sectionName: this.forumSection.name,
      })
      .from(this.forumTopic)
      .leftJoin(
        this.forumSection,
        eq(this.forumSection.id, this.forumTopic.sectionId),
      )
      .where(inArray(this.forumTopic.id, targetIds))

    for (const row of rows) {
      summaryMap.set(
        this.buildTargetSummaryKey({
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetId: row.id,
        }),
        {
          targetId: row.id,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetTypeName: this.getCommentTargetTypeName(
            CommentTargetTypeEnum.FORUM_TOPIC,
          ),
          title: row.title,
          sectionName: options.detail ? row.sectionName : undefined,
          isHidden: options.detail ? row.isHidden : undefined,
          auditStatus: options.detail
            ? (row.auditStatus as AuditStatusEnum)
            : undefined,
          deletedAt: options.detail ? row.deletedAt : undefined,
        },
      )
    }
  }

  // 读取举报作品目标摘要。
  private async appendReportWorkTargetSummaries(
    summaryMap: InteractionReportTargetSummaryMap,
    targets: InteractionTargetSummaryKey[],
    pair: ReportWorkTargetTypePair,
  ) {
    const targetIds = this.getTargetIdsByType(targets, pair.targetType)
    if (targetIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.work.id,
        name: this.work.name,
        deletedAt: this.work.deletedAt,
      })
      .from(this.work)
      .where(
        and(
          inArray(this.work.id, targetIds),
          eq(this.work.type, pair.workType),
        ),
      )

    for (const row of rows) {
      summaryMap.set(
        this.buildTargetSummaryKey({
          targetType: pair.targetType,
          targetId: row.id,
        }),
        {
          targetId: row.id,
          targetType: pair.targetType,
          targetTypeName: this.getReportTargetTypeName(pair.targetType),
          name: row.name,
          deletedAt: row.deletedAt,
        },
      )
    }
  }

  // 读取举报章节目标摘要，并补充所属作品名称。
  private async appendReportChapterTargetSummaries(
    summaryMap: InteractionReportTargetSummaryMap,
    targets: InteractionTargetSummaryKey[],
    pair: ReportWorkTargetTypePair,
  ) {
    const targetIds = this.getTargetIdsByType(targets, pair.targetType)
    if (targetIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.workChapter.id,
        title: this.workChapter.title,
        workName: this.work.name,
        deletedAt: this.workChapter.deletedAt,
      })
      .from(this.workChapter)
      .leftJoin(this.work, eq(this.work.id, this.workChapter.workId))
      .where(
        and(
          inArray(this.workChapter.id, targetIds),
          eq(this.workChapter.workType, pair.workType),
        ),
      )

    for (const row of rows) {
      summaryMap.set(
        this.buildTargetSummaryKey({
          targetType: pair.targetType,
          targetId: row.id,
        }),
        {
          targetId: row.id,
          targetType: pair.targetType,
          targetTypeName: this.getReportTargetTypeName(pair.targetType),
          title: row.title,
          workName: row.workName,
          deletedAt: row.deletedAt,
        },
      )
    }
  }

  // 读取举报论坛主题目标摘要。
  private async appendReportForumTopicTargetSummaries(
    summaryMap: InteractionReportTargetSummaryMap,
    targets: InteractionTargetSummaryKey[],
    options: InteractionSummaryQueryOptions,
  ) {
    const targetIds = this.getTargetIdsByType(
      targets,
      ReportTargetTypeEnum.FORUM_TOPIC,
    )
    if (targetIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.forumTopic.id,
        title: this.forumTopic.title,
        userId: this.forumTopic.userId,
        isHidden: this.forumTopic.isHidden,
        auditStatus: this.forumTopic.auditStatus,
        deletedAt: this.forumTopic.deletedAt,
      })
      .from(this.forumTopic)
      .where(inArray(this.forumTopic.id, targetIds))

    const userMap = await this.getAppUserSummaryMap(
      options.detail ? rows.map((item) => item.userId) : [],
    )

    for (const row of rows) {
      const user = userMap.get(row.userId)
      summaryMap.set(
        this.buildTargetSummaryKey({
          targetType: ReportTargetTypeEnum.FORUM_TOPIC,
          targetId: row.id,
        }),
        {
          targetId: row.id,
          targetType: ReportTargetTypeEnum.FORUM_TOPIC,
          targetTypeName: this.getReportTargetTypeName(
            ReportTargetTypeEnum.FORUM_TOPIC,
          ),
          title: row.title,
          authorNickname: user?.nickname,
          authorAvatarUrl: user?.avatarUrl,
          isHidden: options.detail ? row.isHidden : undefined,
          auditStatus: options.detail
            ? (row.auditStatus as AuditStatusEnum)
            : undefined,
          deletedAt: options.detail ? row.deletedAt : undefined,
        },
      )
    }
  }

  // 读取举报评论目标摘要。
  private async appendReportCommentTargetSummaries(
    summaryMap: InteractionReportTargetSummaryMap,
    targets: InteractionTargetSummaryKey[],
    options: InteractionSummaryQueryOptions,
  ) {
    const targetIds = this.getTargetIdsByType(
      targets,
      ReportTargetTypeEnum.COMMENT,
    )
    if (targetIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.userComment.id,
        userId: this.userComment.userId,
        content: this.userComment.content,
        isHidden: this.userComment.isHidden,
        auditStatus: this.userComment.auditStatus,
        deletedAt: this.userComment.deletedAt,
      })
      .from(this.userComment)
      .where(inArray(this.userComment.id, targetIds))

    const userMap = await this.getAppUserSummaryMap(
      options.detail ? rows.map((item) => item.userId) : [],
    )

    for (const row of rows) {
      const user = userMap.get(row.userId)
      summaryMap.set(
        this.buildTargetSummaryKey({
          targetType: ReportTargetTypeEnum.COMMENT,
          targetId: row.id,
        }),
        {
          targetId: row.id,
          targetType: ReportTargetTypeEnum.COMMENT,
          targetTypeName: this.getReportTargetTypeName(
            ReportTargetTypeEnum.COMMENT,
          ),
          contentExcerpt: this.toExcerpt(row.content),
          authorNickname: user?.nickname,
          authorAvatarUrl: user?.avatarUrl,
          isHidden: options.detail ? row.isHidden : undefined,
          auditStatus: options.detail
            ? (row.auditStatus as AuditStatusEnum)
            : undefined,
          deletedAt: options.detail ? row.deletedAt : undefined,
        },
      )
    }
  }

  // 读取举报用户目标摘要。
  private async appendReportUserTargetSummaries(
    summaryMap: InteractionReportTargetSummaryMap,
    targets: InteractionTargetSummaryKey[],
  ) {
    const targetIds = this.getTargetIdsByType(
      targets,
      ReportTargetTypeEnum.USER,
    )
    if (targetIds.length === 0) {
      return
    }

    const userMap = await this.getAppUserSummaryMap(targetIds)
    for (const [userId, user] of userMap) {
      summaryMap.set(
        this.buildTargetSummaryKey({
          targetType: ReportTargetTypeEnum.USER,
          targetId: userId,
        }),
        {
          targetId: userId,
          targetType: ReportTargetTypeEnum.USER,
          targetTypeName: this.getReportTargetTypeName(
            ReportTargetTypeEnum.USER,
          ),
          name: user.nickname,
          authorNickname: user.nickname,
          authorAvatarUrl: user.avatarUrl,
          status: user.status,
          isEnabled: user.isEnabled,
        },
      )
    }
  }

  // 读取作品业务场景摘要。
  private async appendWorkSceneSummaries(
    summaryMap: InteractionSceneSummaryMap,
    scenes: InteractionSceneSummaryKey[],
    sceneType: SceneTypeEnum,
    workType: number,
  ) {
    const sceneIds = this.getSceneIdsByType(scenes, sceneType)
    if (sceneIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.work.id,
        name: this.work.name,
      })
      .from(this.work)
      .where(and(inArray(this.work.id, sceneIds), eq(this.work.type, workType)))

    for (const row of rows) {
      summaryMap.set(
        this.buildSceneSummaryKey({ sceneType, sceneId: row.id }),
        {
          sceneId: row.id,
          sceneType,
          sceneTypeName: this.getSceneTypeName(sceneType),
          name: row.name,
        },
      )
    }
  }

  // 读取章节业务场景摘要，并补充所属作品名称。
  private async appendChapterSceneSummaries(
    summaryMap: InteractionSceneSummaryMap,
    scenes: InteractionSceneSummaryKey[],
    sceneType: SceneTypeEnum,
    workType: number,
  ) {
    const sceneIds = this.getSceneIdsByType(scenes, sceneType)
    if (sceneIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.workChapter.id,
        title: this.workChapter.title,
        workName: this.work.name,
      })
      .from(this.workChapter)
      .leftJoin(this.work, eq(this.work.id, this.workChapter.workId))
      .where(
        and(
          inArray(this.workChapter.id, sceneIds),
          eq(this.workChapter.workType, workType),
        ),
      )

    for (const row of rows) {
      summaryMap.set(
        this.buildSceneSummaryKey({ sceneType, sceneId: row.id }),
        {
          sceneId: row.id,
          sceneType,
          sceneTypeName: this.getSceneTypeName(sceneType),
          title: row.title,
          parentName: row.workName,
        },
      )
    }
  }

  // 读取论坛主题业务场景摘要，并补充所属板块名称。
  private async appendForumTopicSceneSummaries(
    summaryMap: InteractionSceneSummaryMap,
    scenes: InteractionSceneSummaryKey[],
  ) {
    const sceneIds = this.getSceneIdsByType(scenes, SceneTypeEnum.FORUM_TOPIC)
    if (sceneIds.length === 0) {
      return
    }

    const rows = await this.db
      .select({
        id: this.forumTopic.id,
        title: this.forumTopic.title,
        sectionName: this.forumSection.name,
      })
      .from(this.forumTopic)
      .leftJoin(
        this.forumSection,
        eq(this.forumSection.id, this.forumTopic.sectionId),
      )
      .where(inArray(this.forumTopic.id, sceneIds))

    for (const row of rows) {
      summaryMap.set(
        this.buildSceneSummaryKey({
          sceneType: SceneTypeEnum.FORUM_TOPIC,
          sceneId: row.id,
        }),
        {
          sceneId: row.id,
          sceneType: SceneTypeEnum.FORUM_TOPIC,
          sceneTypeName: this.getSceneTypeName(SceneTypeEnum.FORUM_TOPIC),
          title: row.title,
          parentName: row.sectionName,
        },
      )
    }
  }

  // 读取用户主页业务场景摘要。
  private async appendUserProfileSceneSummaries(
    summaryMap: InteractionSceneSummaryMap,
    scenes: InteractionSceneSummaryKey[],
  ) {
    const sceneIds = this.getSceneIdsByType(scenes, SceneTypeEnum.USER_PROFILE)
    if (sceneIds.length === 0) {
      return
    }

    const userMap = await this.getAppUserSummaryMap(sceneIds)
    for (const [userId, user] of userMap) {
      summaryMap.set(
        this.buildSceneSummaryKey({
          sceneType: SceneTypeEnum.USER_PROFILE,
          sceneId: userId,
        }),
        {
          sceneId: userId,
          sceneType: SceneTypeEnum.USER_PROFILE,
          sceneTypeName: this.getSceneTypeName(SceneTypeEnum.USER_PROFILE),
          name: user.nickname,
        },
      )
    }
  }

  // 获取评论目标类型的中文名称。
  private getCommentTargetTypeName(targetType: CommentTargetTypeEnum) {
    switch (targetType) {
      case CommentTargetTypeEnum.COMIC:
        return '漫画作品'
      case CommentTargetTypeEnum.NOVEL:
        return '小说作品'
      case CommentTargetTypeEnum.COMIC_CHAPTER:
        return '漫画章节'
      case CommentTargetTypeEnum.NOVEL_CHAPTER:
        return '小说章节'
      case CommentTargetTypeEnum.FORUM_TOPIC:
        return '论坛主题'
      default:
        return '未知目标'
    }
  }

  // 获取举报目标类型的中文名称。
  private getReportTargetTypeName(targetType: ReportTargetTypeEnum) {
    switch (targetType) {
      case ReportTargetTypeEnum.COMIC:
        return '漫画作品'
      case ReportTargetTypeEnum.NOVEL:
        return '小说作品'
      case ReportTargetTypeEnum.COMIC_CHAPTER:
        return '漫画章节'
      case ReportTargetTypeEnum.NOVEL_CHAPTER:
        return '小说章节'
      case ReportTargetTypeEnum.FORUM_TOPIC:
        return '论坛主题'
      case ReportTargetTypeEnum.COMMENT:
        return '评论'
      case ReportTargetTypeEnum.USER:
        return '用户'
      default:
        return '未知目标'
    }
  }

  // 获取业务场景类型的中文名称。
  private getSceneTypeName(sceneType: SceneTypeEnum) {
    switch (sceneType) {
      case SceneTypeEnum.COMIC_WORK:
        return '漫画作品'
      case SceneTypeEnum.NOVEL_WORK:
        return '小说作品'
      case SceneTypeEnum.FORUM_TOPIC:
        return '论坛主题'
      case SceneTypeEnum.COMIC_CHAPTER:
        return '漫画章节'
      case SceneTypeEnum.NOVEL_CHAPTER:
        return '小说章节'
      case SceneTypeEnum.USER_PROFILE:
        return '用户主页'
      default:
        return '未知场景'
    }
  }

  // 获取管理员账号角色名称。
  private getAdminUserRoleName(role: AdminUserRoleEnum) {
    switch (role) {
      case AdminUserRoleEnum.SUPER_ADMIN:
        return '超级管理员'
      case AdminUserRoleEnum.NORMAL_ADMIN:
      default:
        return '普通管理员'
    }
  }
}
