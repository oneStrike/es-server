import type { AppUserSelect } from '@db/schema'
import { DrizzleService } from '@db/core'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { EmojiParserService } from '@libs/interaction/emoji/emoji-parser.service'
import { MessageNotificationComposerService } from '@libs/message/notification/notification-composer.service'
import { MessageOutboxService } from '@libs/message/outbox/outbox.service'
import { UserService } from '@libs/user/user.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { MentionSourceTypeEnum } from './mention.constant'
import type {
  BuildMentionBodyTokensInput,
  DeleteMentionsInTxInput,
  DispatchCommentMentionsInTxInput,
  DispatchTopicMentionsInTxInput,
  NormalizedMentionDraft,
  ReplaceMentionsInTxInput,
} from './mention.type'

/**
 * mentions 共享服务。
 * 统一负责提及区间校验、bodyTokens 构建、事实表替换和通知补发。
 */
@Injectable()
export class MentionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly emojiParserService: EmojiParserService,
    private readonly userService: UserService,
    private readonly messageOutboxService: MessageOutboxService,
    private readonly messageNotificationComposerService: MessageNotificationComposerService,
  ) {}

  private get userMention() {
    return this.drizzle.schema.userMention
  }

  /**
   * 构建正文 token。
   * 先校验 mentions 区间，再把 mention token 与 emoji token 按原始顺序拼回。
   */
  async buildBodyTokens(
    input: BuildMentionBodyTokensInput,
  ) {
    const normalizedMentions = this.normalizeMentions(
      input.content,
      input.mentions,
    )

    if (input.content.length === 0) {
      return []
    }
    if (normalizedMentions.length === 0) {
      return this.emojiParserService.parse({
        body: input.content,
        scene: input.scene,
      })
    }

    const tokens: Awaited<ReturnType<EmojiParserService['parse']>> = []
    let cursor = 0

    for (const mention of normalizedMentions) {
      if (mention.start > cursor) {
        tokens.push(
          ...(await this.emojiParserService.parse({
            body: input.content.slice(cursor, mention.start),
            scene: input.scene,
          })),
        )
      }

      tokens.push({
        type: 'mentionUser',
        userId: mention.userId,
        nickname: mention.nickname,
        text: mention.text,
      })
      cursor = mention.end
    }

    if (cursor < input.content.length) {
      tokens.push(
        ...(await this.emojiParserService.parse({
          body: input.content.slice(cursor),
          scene: input.scene,
        })),
      )
    }

    return tokens
  }

  /**
   * 在事务内全量替换来源正文的 mention 事实。
   * 同一用户若已经通知过，则在本次替换中继续保留 notifiedAt，避免可见更新重复提醒。
   */
  async replaceMentionsInTx(input: ReplaceMentionsInTxInput) {
    const normalizedMentions = this.normalizeMentions(
      input.content,
      input.mentions,
    )

    const previousRows = await input.tx
      .select({
        mentionedUserId: this.userMention.mentionedUserId,
        notifiedAt: this.userMention.notifiedAt,
      })
      .from(this.userMention)
      .where(
        and(
          eq(this.userMention.sourceType, input.sourceType),
          eq(this.userMention.sourceId, input.sourceId),
        ),
      )

    const preservedNotifiedAtMap = new Map<number, Date>()
    for (const row of previousRows) {
      if (row.notifiedAt && !preservedNotifiedAtMap.has(row.mentionedUserId)) {
        preservedNotifiedAtMap.set(row.mentionedUserId, row.notifiedAt)
      }
    }

    await input.tx
      .delete(this.userMention)
      .where(
        and(
          eq(this.userMention.sourceType, input.sourceType),
          eq(this.userMention.sourceId, input.sourceId),
        ),
      )

    if (normalizedMentions.length === 0) {
      return {
        mentionedUserIds: [] as number[],
        pendingUserIds: [] as number[],
      }
    }

    const availableUsers = await this.userService.findAvailableUsersByIds(
      normalizedMentions.map((item) => item.userId),
    )
    const availableUserIds = new Set(availableUsers.map((item) => item.id))
    const invalidMention = normalizedMentions.find(
      (item) => !availableUserIds.has(item.userId),
    )
    if (invalidMention) {
      throw new BadRequestException('被提及用户不存在或不可用')
    }

    const rows = normalizedMentions.map((mention) => ({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      mentionedUserId: mention.userId,
      startOffset: mention.start,
      endOffset: mention.end,
      notifiedAt: preservedNotifiedAtMap.get(mention.userId) ?? null,
    }))

    await input.tx.insert(this.userMention).values(rows)

    const mentionedUserIds = [...new Set(rows.map((row) => row.mentionedUserId))]
    const pendingUserIds = [
      ...new Set(
        rows
          .filter((row) => row.notifiedAt === null)
          .map((row) => row.mentionedUserId),
      ),
    ]

    return {
      mentionedUserIds,
      pendingUserIds,
    }
  }

  /**
   * 补发评论 mention 通知。
   * 仅消费当前仍未通知的 mention 事实，并在同一事务内标记 notifiedAt。
   */
  async dispatchCommentMentionsInTx(
    tx: ReplaceMentionsInTxInput['tx'],
    input: DispatchCommentMentionsInTxInput,
  ) {
    const receiverUserIds = await this.getPendingMentionReceiverUserIds(
      tx,
      MentionSourceTypeEnum.COMMENT,
      input.commentId,
    )
    if (receiverUserIds.length === 0) {
      return
    }

    const actor = await this.getActorSnapshot(tx, input.actorUserId)
    for (const receiverUserId of receiverUserIds) {
      await this.messageOutboxService.enqueueNotificationEventInTx(
        tx,
        this.messageNotificationComposerService.buildCommentMentionEvent({
          bizKey: `notify:comment-mention:${input.commentId}:receiver:${receiverUserId}`,
          receiverUserId,
          actorUserId: input.actorUserId,
          targetType: input.targetType,
          targetId: input.targetId,
          subjectId: input.commentId,
          payload: {
            actorNickname: actor?.nickname,
            commentExcerpt: input.content,
            targetDisplayTitle: input.targetDisplayTitle,
          },
        }),
      )
    }

    await this.markMentionReceiversNotifiedInTx(
      tx,
      MentionSourceTypeEnum.COMMENT,
      input.commentId,
      receiverUserIds,
    )
  }

  /**
   * 补发主题 mention 通知。
   * 可见创建、可见更新以及首次转可见都复用这一条链路。
   */
  async dispatchTopicMentionsInTx(
    tx: ReplaceMentionsInTxInput['tx'],
    input: DispatchTopicMentionsInTxInput,
  ) {
    const receiverUserIds = await this.getPendingMentionReceiverUserIds(
      tx,
      MentionSourceTypeEnum.FORUM_TOPIC,
      input.topicId,
    )
    if (receiverUserIds.length === 0) {
      return
    }

    const actor = await this.getActorSnapshot(tx, input.actorUserId)
    for (const receiverUserId of receiverUserIds) {
      await this.messageOutboxService.enqueueNotificationEventInTx(
        tx,
        this.messageNotificationComposerService.buildTopicMentionEvent({
          bizKey: `notify:topic-mention:${input.topicId}:receiver:${receiverUserId}`,
          receiverUserId,
          actorUserId: input.actorUserId,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetId: input.topicId,
          subjectId: input.topicId,
          payload: {
            actorNickname: actor?.nickname,
            topicTitle: input.topicTitle,
          },
        }),
      )
    }

    await this.markMentionReceiversNotifiedInTx(
      tx,
      MentionSourceTypeEnum.FORUM_TOPIC,
      input.topicId,
      receiverUserIds,
    )
  }

  /**
   * 删除来源关联的 mention 事实。
   * 用于评论/主题删除时清理残留提及记录。
   */
  async deleteMentionsInTx(input: DeleteMentionsInTxInput) {
    if (input.sourceIds.length === 0) {
      return
    }

    await input.tx
      .delete(this.userMention)
      .where(
        and(
          eq(this.userMention.sourceType, input.sourceType),
          input.sourceIds.length === 1
            ? eq(this.userMention.sourceId, input.sourceIds[0]!)
            : inArray(this.userMention.sourceId, input.sourceIds),
        ),
      )
  }

  /**
   * 规范化 mentions。
   * - 位置必须位于正文内且不重叠
   * - 正文切片必须精确等于 `@昵称`
   */
  private normalizeMentions(
    content: string,
    mentions?: BuildMentionBodyTokensInput['mentions'],
  ): NormalizedMentionDraft[] {
    if (!mentions?.length) {
      return []
    }

    const normalizedMentions = mentions
      .map((mention) => {
        const nickname = mention.nickname.trim()
        if (!nickname) {
          throw new BadRequestException('提及昵称不能为空')
        }
        if (
          !Number.isInteger(mention.start) ||
          !Number.isInteger(mention.end) ||
          mention.start < 0 ||
          mention.end <= mention.start ||
          mention.end > content.length
        ) {
          throw new BadRequestException('提及位置非法')
        }

        const text = content.slice(mention.start, mention.end)
        if (text !== `@${nickname}`) {
          throw new BadRequestException('提及位置与正文不匹配')
        }

        return {
          userId: mention.userId,
          nickname,
          start: mention.start,
          end: mention.end,
          text,
        }
      })
      .sort((left, right) => left.start - right.start || left.end - right.end)

    let previousEnd = -1
    for (const mention of normalizedMentions) {
      if (mention.start < previousEnd) {
        throw new BadRequestException('提及区间不能重叠')
      }
      previousEnd = mention.end
    }

    return normalizedMentions
  }

  /**
   * 查询当前来源上仍未通知的接收人。
   */
  private async getPendingMentionReceiverUserIds(
    tx: ReplaceMentionsInTxInput['tx'],
    sourceType: MentionSourceTypeEnum,
    sourceId: number,
  ) {
    const rows = await tx
      .select({
        mentionedUserId: this.userMention.mentionedUserId,
      })
      .from(this.userMention)
      .where(
        and(
          eq(this.userMention.sourceType, sourceType),
          eq(this.userMention.sourceId, sourceId),
          isNull(this.userMention.notifiedAt),
        ),
      )

    return [...new Set(rows.map((row) => row.mentionedUserId))]
  }

  /**
   * 在同一事务内回写 notifiedAt，避免重复补发。
   */
  private async markMentionReceiversNotifiedInTx(
    tx: ReplaceMentionsInTxInput['tx'],
    sourceType: MentionSourceTypeEnum,
    sourceId: number,
    receiverUserIds: number[],
  ) {
    if (receiverUserIds.length === 0) {
      return
    }

    await tx
      .update(this.userMention)
      .set({
        notifiedAt: new Date(),
      })
      .where(
        and(
          eq(this.userMention.sourceType, sourceType),
          eq(this.userMention.sourceId, sourceId),
          inArray(this.userMention.mentionedUserId, receiverUserIds),
          isNull(this.userMention.notifiedAt),
        ),
      )
  }

  /**
   * 加载触发者昵称快照。
   * 只取通知文案需要的最小字段。
   */
  private async getActorSnapshot(
    tx: ReplaceMentionsInTxInput['tx'],
    actorUserId: number,
  ): Promise<Pick<AppUserSelect, 'id' | 'nickname'> | undefined> {
    return tx.query.appUser.findFirst({
      where: {
        id: actorUserId,
      },
      columns: {
        id: true,
        nickname: true,
      },
    })
  }
}
