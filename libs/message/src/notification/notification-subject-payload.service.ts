import type { DrizzleService } from '@db/core'
import type { StructuredValue } from '@libs/platform/utils/jsonParse'
import type {
  NotificationPayloadNormalizationResult,
  NotificationPayloadRecord,
  NotificationPayloadSubject,
  NotificationPayloadSubjectKind,
} from './notification-subject-payload.type'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { Injectable } from '@nestjs/common'
import {
  MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  type MessageNotificationCategoryKey,
} from './notification.constant'

const NOTIFICATION_SUBJECT_CATEGORY_SET =
  new Set<MessageNotificationCategoryKey>([
    MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
    MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_MENTION,
    MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE,
    MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_LIKE,
    MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_FAVORITED,
    MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_COMMENTED,
    MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_MENTIONED,
    MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.SYSTEM_ANNOUNCEMENT,
    MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER,
  ])

function isPlainRecord(
  value: StructuredValue | undefined,
): value is Record<string, StructuredValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMeaningfulString(
  value: StructuredValue | undefined,
): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toPositiveInteger(value: StructuredValue | undefined) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim())
    return parsed > 0 ? parsed : undefined
  }
  return undefined
}

function firstNonEmptyString(values: StructuredValue | undefined) {
  if (!Array.isArray(values)) {
    return undefined
  }

  return values.find((value) => typeof value === 'string' && value.trim()) as
    | string
    | undefined
}

function pickDefinedFields(
  payload: Record<string, StructuredValue>,
  keys: string[],
): NotificationPayloadRecord {
  const picked: NotificationPayloadRecord = {}
  for (const key of keys) {
    const value = payload[key]
    if (value !== undefined) {
      picked[key] = value
    }
  }
  return picked
}

function buildExtraRecord(
  input: Record<string, StructuredValue | undefined>,
): Record<string, StructuredValue> | undefined {
  const extra: Record<string, StructuredValue> = {}

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      extra[key] = value
    }
  }

  return Object.keys(extra).length > 0 ? extra : undefined
}

function isNotificationSubject(
  value: StructuredValue | undefined,
): value is NotificationPayloadSubject {
  return (
    isPlainRecord(value) &&
    typeof value.kind === 'string' &&
    toPositiveInteger(value.id) !== undefined
  )
}

function isMinimalSubject(subject?: NotificationPayloadSubject) {
  if (!subject) {
    return false
  }
  return !subject.title && !subject.subtitle && !subject.cover
}

@Injectable()
export class MessageNotificationSubjectPayloadService {
  constructor(private readonly drizzle: DrizzleService) {}

  async normalizePayload(
    categoryKey: MessageNotificationCategoryKey,
    payload?: StructuredValue,
  ) {
    return (await this.normalizePayloadDetailed(categoryKey, payload)).payload
  }

  async normalizePayloadDetailed(
    categoryKey: MessageNotificationCategoryKey,
    payload?: StructuredValue,
  ): Promise<NotificationPayloadNormalizationResult> {
    const sourcePayload = isPlainRecord(payload) ? payload : {}
    const retainedPayload = this.buildRetainedPayload(
      categoryKey,
      sourcePayload,
    )

    if (!NOTIFICATION_SUBJECT_CATEGORY_SET.has(categoryKey)) {
      return {
        payload: this.mergePayload(retainedPayload),
        unresolved: false,
      }
    }

    const existingSubject = this.toSubjectSnapshot(sourcePayload.subject)
    const existingParentSubject = this.toSubjectSnapshot(
      sourcePayload.parentSubject,
    )
    const resolvedSubjects = await this.resolveSubjectSnapshots(
      categoryKey,
      sourcePayload,
      existingSubject,
      existingParentSubject,
    )

    return {
      payload: this.mergePayload(
        retainedPayload,
        resolvedSubjects.subject,
        resolvedSubjects.parentSubject,
      ),
      unresolved:
        !resolvedSubjects.subject ||
        isMinimalSubject(resolvedSubjects.subject) ||
        isMinimalSubject(resolvedSubjects.parentSubject),
    }
  }

  private mergePayload(
    retainedPayload: NotificationPayloadRecord,
    subject?: NotificationPayloadSubject,
    parentSubject?: NotificationPayloadSubject,
  ) {
    const normalized: NotificationPayloadRecord = {
      ...retainedPayload,
    }

    if (subject) {
      normalized.subject = subject
    }

    if (parentSubject) {
      normalized.parentSubject = parentSubject
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined
  }

  private buildRetainedPayload(
    categoryKey: MessageNotificationCategoryKey,
    payload: Record<string, StructuredValue>,
  ) {
    switch (categoryKey) {
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY:
        return pickDefinedFields(payload, [
          'actorNickname',
          'commentId',
          'replyExcerpt',
        ])
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_MENTION:
        return pickDefinedFields(payload, [
          'actorNickname',
          'commentId',
          'commentExcerpt',
        ])
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE:
        return pickDefinedFields(payload, ['actorNickname', 'commentId'])
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_LIKE:
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_FAVORITED:
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_MENTIONED:
        return pickDefinedFields(payload, ['actorNickname'])
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_COMMENTED:
        return pickDefinedFields(payload, [
          'actorNickname',
          'commentId',
          'commentExcerpt',
        ])
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.SYSTEM_ANNOUNCEMENT:
        return pickDefinedFields(payload, [
          'announcementId',
          'announcementType',
          'priorityLevel',
        ])
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER:
        return pickDefinedFields(payload, [
          'reminderKind',
          'taskId',
          'taskCode',
          'sceneType',
          'cycleKey',
          'assignmentId',
          'expiredAt',
          'actionUrl',
          'rewardSummary',
          'points',
          'experience',
          'ledgerRecordIds',
        ])
      case MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.USER_FOLLOWED:
        return pickDefinedFields(payload, ['actorNickname'])
      default:
        return {}
    }
  }

  private toSubjectSnapshot(
    value: StructuredValue | undefined,
  ): NotificationPayloadSubject | undefined {
    if (!isNotificationSubject(value)) {
      return undefined
    }

    const subject: NotificationPayloadSubject = {
      kind: value.kind as NotificationPayloadSubjectKind,
      id: toPositiveInteger(value.id)!,
    }

    if (isMeaningfulString(value.title)) {
      subject.title = value.title
    }
    if (isMeaningfulString(value.subtitle)) {
      subject.subtitle = value.subtitle
    }
    if (isMeaningfulString(value.cover)) {
      subject.cover = value.cover
    }
    if (isPlainRecord(value.extra)) {
      subject.extra = value.extra
    }

    return subject
  }

  private async resolveSubjectSnapshots(
    categoryKey: MessageNotificationCategoryKey,
    payload: Record<string, StructuredValue>,
    existingSubject?: NotificationPayloadSubject,
    existingParentSubject?: NotificationPayloadSubject,
  ) {
    if (existingSubject) {
      if (existingSubject.kind !== 'chapter' || existingParentSubject) {
        return {
          subject: existingSubject,
          parentSubject: existingParentSubject,
        }
      }
    }

    if (
      categoryKey === MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_LIKE ||
      categoryKey === MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_FAVORITED ||
      categoryKey === MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_COMMENTED ||
      categoryKey === MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_MENTIONED
    ) {
      return {
        subject: await this.loadTopicSubject(
          toPositiveInteger(payload.topicId) ??
            toPositiveInteger(payload.targetId) ??
            existingSubject?.id,
        ),
      }
    }

    if (
      categoryKey === MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.SYSTEM_ANNOUNCEMENT
    ) {
      return {
        subject: await this.loadAnnouncementSubject(
          toPositiveInteger(payload.announcementId) ?? existingSubject?.id,
          payload,
        ),
      }
    }

    if (categoryKey === MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER) {
      return {
        subject: await this.loadTaskSubject(
          toPositiveInteger(payload.taskId) ?? existingSubject?.id,
          payload,
        ),
      }
    }

    return this.loadCommentTargetSubjects(
      toPositiveInteger(payload.targetType) ??
        this.mapSubjectKindToCommentTargetType(existingSubject?.kind),
      toPositiveInteger(payload.targetId) ?? existingSubject?.id,
    )
  }

  private mapSubjectKindToCommentTargetType(
    kind?: NotificationPayloadSubjectKind,
  ) {
    switch (kind) {
      case 'work':
        return CommentTargetTypeEnum.COMIC
      case 'chapter':
        return CommentTargetTypeEnum.COMIC_CHAPTER
      case 'topic':
        return CommentTargetTypeEnum.FORUM_TOPIC
      default:
        return undefined
    }
  }

  private async loadCommentTargetSubjects(
    targetType?: number,
    targetId?: number,
  ) {
    switch (targetType) {
      case CommentTargetTypeEnum.COMIC:
      case CommentTargetTypeEnum.NOVEL:
        return {
          subject: await this.loadWorkSubject(targetId),
        }
      case CommentTargetTypeEnum.COMIC_CHAPTER:
      case CommentTargetTypeEnum.NOVEL_CHAPTER:
        return this.loadChapterSubjects(targetId)
      case CommentTargetTypeEnum.FORUM_TOPIC:
        return {
          subject: await this.loadTopicSubject(targetId),
        }
      default:
        return {
          subject: undefined,
          parentSubject: undefined,
        }
    }
  }

  private async loadWorkSubject(workId?: number) {
    if (!workId) {
      return undefined
    }

    const work = await this.drizzle.db.query.work.findFirst({
      where: {
        id: workId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        name: true,
        cover: true,
        type: true,
      },
    })

    if (!work) {
      return this.buildMinimalSubject('work', workId)
    }

    return {
      kind: 'work',
      id: work.id,
      title: work.name,
      cover: work.cover ?? undefined,
      extra: buildExtraRecord({
        type: work.type,
      }),
    } satisfies NotificationPayloadSubject
  }

  private async loadChapterSubjects(chapterId?: number) {
    if (!chapterId) {
      return {
        subject: undefined,
        parentSubject: undefined,
      }
    }

    const chapter = await this.drizzle.db.query.workChapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        title: true,
        subtitle: true,
        cover: true,
        workId: true,
        workType: true,
      },
      with: {
        work: {
          columns: {
            id: true,
            name: true,
            cover: true,
            type: true,
          },
        },
      },
    })

    if (!chapter) {
      return {
        subject: this.buildMinimalSubject('chapter', chapterId),
        parentSubject: undefined,
      }
    }

    return {
      subject: {
        kind: 'chapter',
        id: chapter.id,
        title: chapter.title,
        subtitle: chapter.subtitle ?? undefined,
        cover: chapter.cover ?? chapter.work?.cover ?? undefined,
        extra: {
          workId: chapter.workId,
          workType: chapter.workType,
        },
      } satisfies NotificationPayloadSubject,
      parentSubject: chapter.work
        ? ({
            kind: 'work',
            id: chapter.work.id,
            title: chapter.work.name,
            cover: chapter.work.cover ?? undefined,
            extra: buildExtraRecord({
              type: chapter.work.type,
            }),
          } satisfies NotificationPayloadSubject)
        : this.buildMinimalSubject('work', chapter.workId),
    }
  }

  private async loadTopicSubject(topicId?: number) {
    if (!topicId) {
      return undefined
    }

    const topic = await this.drizzle.db.query.forumTopic.findFirst({
      where: {
        id: topicId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        title: true,
        sectionId: true,
        images: true,
      },
    })

    if (!topic) {
      return this.buildMinimalSubject('topic', topicId)
    }

    return {
      kind: 'topic',
      id: topic.id,
      title: topic.title,
      cover: firstNonEmptyString(topic.images),
      extra: buildExtraRecord({
        sectionId: topic.sectionId,
      }),
    } satisfies NotificationPayloadSubject
  }

  private async loadAnnouncementSubject(
    announcementId?: number,
    payload?: Record<string, StructuredValue>,
  ) {
    if (!announcementId) {
      return undefined
    }

    const announcement = await this.drizzle.db.query.appAnnouncement.findFirst({
      where: {
        id: announcementId,
      },
      columns: {
        id: true,
        title: true,
        summary: true,
        announcementType: true,
        priorityLevel: true,
      },
    })

    if (!announcement) {
      return {
        ...this.buildMinimalSubject('announcement', announcementId),
        extra: buildExtraRecord({
          announcementType: payload?.announcementType,
          priorityLevel: payload?.priorityLevel,
        }),
      }
    }

    return {
      kind: 'announcement',
      id: announcement.id,
      title: announcement.title,
      extra: buildExtraRecord({
        announcementType: announcement.announcementType,
        priorityLevel: announcement.priorityLevel,
        summary: announcement.summary ?? undefined,
      }),
    } satisfies NotificationPayloadSubject
  }

  private async loadTaskSubject(
    taskId?: number,
    payload?: Record<string, StructuredValue>,
  ) {
    if (!taskId) {
      return undefined
    }

    const task = await this.drizzle.db.query.task.findFirst({
      where: {
        id: taskId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        title: true,
        cover: true,
        code: true,
        type: true,
      },
    })

    if (!task) {
      return {
        ...this.buildMinimalSubject('task', taskId),
        extra: buildExtraRecord({
          code: payload?.taskCode,
          type: payload?.sceneType,
        }),
      }
    }

    return {
      kind: 'task',
      id: task.id,
      title: task.title,
      cover: task.cover ?? undefined,
      extra: buildExtraRecord({
        code: task.code,
        type: task.type,
      }),
    } satisfies NotificationPayloadSubject
  }

  private buildMinimalSubject(
    kind: NotificationPayloadSubjectKind,
    id: number,
  ): NotificationPayloadSubject {
    return {
      kind,
      id,
    }
  }
}
