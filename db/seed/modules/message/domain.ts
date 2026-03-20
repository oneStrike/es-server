import type { Db } from '../../db-client'
import { and, eq } from 'drizzle-orm'
import {
  ChatConversationMemberRoleEnum,
  ChatMessageStatusEnum,
  ChatMessageTypeEnum,
} from '../../../../libs/message/src/chat/chat.constant'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
} from '../../../../libs/message/src/notification/notification.constant'
import {
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from '../../../../libs/message/src/outbox/outbox.constant'
import { InteractionTargetTypeEnum } from '../../../../libs/platform/src/constant/interaction.constant'
import {
  appAnnouncement,
  appUser,
  chatConversation,
  chatConversationMember,
  chatMessage,
  messageOutbox,
  messageWsMetric,
  userComment,
  userNotification,
} from '../../../schema'
import { addMinutes, SEED_ACCOUNTS, SEED_TIMELINE } from '../../shared'

export async function seedMessageDomain(db: Db) {
  console.log('🌱 初始化消息域数据...')

  const userA = await db.query.appUser.findFirst({
    where: eq(appUser.account, SEED_ACCOUNTS.readerA),
  })
  const userB = await db.query.appUser.findFirst({
    where: eq(appUser.account, SEED_ACCOUNTS.readerB),
  })
  const userC = await db.query.appUser.findFirst({
    where: eq(appUser.account, SEED_ACCOUNTS.readerC),
  })

  if (!userA || !userB || !userC) {
    console.log('  ℹ 缺少 seed 用户，跳过消息域数据')
    return
  }

  const directPair = [userA.id, userB.id].sort((left, right) => left - right)
  const conversationBizKey = `direct:${directPair[0]}:${directPair[1]}`

  let conversation = await db.query.chatConversation.findFirst({
    where: eq(chatConversation.bizKey, conversationBizKey),
  })

  if (!conversation) {
    ;[conversation] = await db
      .insert(chatConversation)
      .values({
        bizKey: conversationBizKey,
      })
      .returning()
  }

  const messageFixtures = [
    {
      messageSeq: 1n,
      senderId: userA.id,
      clientMessageId: 'seed-chat-1',
      messageType: ChatMessageTypeEnum.TEXT,
      content: '你把进击的巨人前三卷的伏笔整理得很完整。',
      payload: null,
      status: ChatMessageStatusEnum.NORMAL,
      createdAt: addMinutes(SEED_TIMELINE.seedAt, -15),
    },
    {
      messageSeq: 2n,
      senderId: userB.id,
      clientMessageId: 'seed-chat-2',
      messageType: ChatMessageTypeEnum.TEXT,
      content: '我后面想把白夜行的人物线也整理成帖子。',
      payload: null,
      status: ChatMessageStatusEnum.NORMAL,
      createdAt: addMinutes(SEED_TIMELINE.seedAt, -13),
    },
    {
      messageSeq: 3n,
      senderId: userB.id,
      clientMessageId: 'seed-chat-3',
      messageType: ChatMessageTypeEnum.SYSTEM,
      content: '今晚如果有空，我们把论坛标签也统一一下。',
      payload: { source: 'seed' },
      status: ChatMessageStatusEnum.NORMAL,
      createdAt: addMinutes(SEED_TIMELINE.seedAt, -10),
    },
  ] as const

  for (const fixture of messageFixtures) {
    const existing = await db.query.chatMessage.findFirst({
      where: and(
        eq(chatMessage.conversationId, conversation.id),
        eq(chatMessage.messageSeq, fixture.messageSeq),
      ),
    })

    if (!existing) {
      await db.insert(chatMessage).values({
        conversationId: conversation.id,
        ...fixture,
      })
    } else {
      await db
        .update(chatMessage)
        .set({
          conversationId: conversation.id,
          ...fixture,
        })
        .where(eq(chatMessage.id, existing.id))
    }
  }

  const messages = await db.query.chatMessage.findMany({
    where: eq(chatMessage.conversationId, conversation.id),
  })
  const lastMessage = [...messages]
    .sort((left, right) => {
      return Number(left.messageSeq - right.messageSeq)
    })
    .at(-1)

  if (lastMessage) {
    ;[conversation] = await db
      .update(chatConversation)
      .set({
        lastMessageId: lastMessage.id,
        lastMessageAt: lastMessage.createdAt,
        lastSenderId: lastMessage.senderId,
      })
      .where(eq(chatConversation.id, conversation.id))
      .returning()
  }
  console.log('  ✓ 会话与消息完成')

  const messageBySeq = new Map<bigint, (typeof messages)[number]>(
    messages.map((item) => [item.messageSeq, item]),
  )
  const memberFixtures = [
    {
      userId: userA.id,
      role: ChatConversationMemberRoleEnum.OWNER,
      lastReadMessageId: messageBySeq.get(2n)?.id ?? null,
      lastReadAt: messageBySeq.get(2n)?.createdAt ?? null,
      unreadCount: 1,
      joinedAt: addMinutes(SEED_TIMELINE.seedAt, -20),
    },
    {
      userId: userB.id,
      role: ChatConversationMemberRoleEnum.MEMBER,
      lastReadMessageId: messageBySeq.get(3n)?.id ?? null,
      lastReadAt: messageBySeq.get(3n)?.createdAt ?? null,
      unreadCount: 0,
      joinedAt: addMinutes(SEED_TIMELINE.seedAt, -20),
    },
  ] as const

  for (const fixture of memberFixtures) {
    const existing = await db.query.chatConversationMember.findFirst({
      where: and(
        eq(chatConversationMember.conversationId, conversation.id),
        eq(chatConversationMember.userId, fixture.userId),
      ),
    })

    if (!existing) {
      await db.insert(chatConversationMember).values({
        conversationId: conversation.id,
        ...fixture,
      })
    } else {
      await db
        .update(chatConversationMember)
        .set({
          conversationId: conversation.id,
          ...fixture,
        })
        .where(eq(chatConversationMember.id, existing.id))
    }
  }
  console.log('  ✓ 会话成员完成')

  const announcement = await db.query.appAnnouncement.findFirst({
    where: eq(appAnnouncement.title, '2026 春季版本更新'),
  })
  const rootReply = await db.query.userComment.findFirst({
    where: eq(userComment.content, '我觉得第一卷就把未来冲突埋得很深。'),
  })
  const replyComment = await db.query.userComment.findFirst({
    where: eq(
      userComment.content,
      '而且艾伦和调查兵团的立场差异很早就有预警。',
    ),
  })

  const notificationFixtures = [
    {
      userId: userB.id,
      type: MessageNotificationTypeEnum.COMMENT_REPLY,
      bizKey: 'seed:notif:comment-reply:aot',
      actorUserId: userA.id,
      targetType: InteractionTargetTypeEnum.COMMENT,
      targetId: rootReply?.id ?? null,
      subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
      subjectId: replyComment?.id ?? null,
      title: '你的评论收到了回复',
      content: '小光回复了你在《进击的巨人》话题下的评论。',
      payload: { topic: '进击的巨人：前三卷伏笔整理' },
      aggregateKey: 'seed:comment-reply:aot',
      aggregateCount: 1,
      isRead: false,
      readAt: null,
      expiredAt: null,
    },
    {
      userId: userC.id,
      type: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
      bizKey: 'seed:notif:system-announcement:2026-spring',
      actorUserId: null,
      targetType: null,
      targetId: announcement?.id ?? null,
      subjectType: MessageNotificationSubjectTypeEnum.SYSTEM,
      subjectId: announcement?.id ?? null,
      title: '春季版本更新公告',
      content: '系统已更新到 2026.03 seed 版本，包含完整联调数据。',
      payload: { announcementId: announcement?.id ?? null },
      aggregateKey: 'seed:system-announcement',
      aggregateCount: 1,
      isRead: false,
      readAt: null,
      expiredAt: null,
    },
    {
      userId: userA.id,
      type: MessageNotificationTypeEnum.CHAT_MESSAGE,
      bizKey: 'seed:notif:chat-message:direct',
      actorUserId: userB.id,
      targetType: InteractionTargetTypeEnum.USER,
      targetId: userB.id,
      subjectType: MessageNotificationSubjectTypeEnum.USER,
      subjectId: userB.id,
      title: '你收到一条新私信',
      content: '阿澈刚刚给你发送了一条消息。',
      payload: { conversationId: conversation.id, lastMessageSeq: 3 },
      aggregateKey: 'seed:chat:direct',
      aggregateCount: 1,
      isRead: false,
      readAt: null,
      expiredAt: null,
    },
  ] as const

  for (const fixture of notificationFixtures) {
    const existing = await db.query.userNotification.findFirst({
      where: and(
        eq(userNotification.userId, fixture.userId),
        eq(userNotification.bizKey, fixture.bizKey),
      ),
    })

    if (!existing) {
      await db.insert(userNotification).values(fixture)
    } else {
      await db
        .update(userNotification)
        .set(fixture)
        .where(eq(userNotification.id, existing.id))
    }
  }
  console.log('  ✓ 站内通知完成')

  const outboxFixtures = [
    {
      domain: MessageOutboxDomainEnum.NOTIFICATION,
      eventType: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
      bizKey: 'seed:outbox:notif:2026-spring',
      payload: {
        notificationBizKey: 'seed:notif:system-announcement:2026-spring',
      },
      status: MessageOutboxStatusEnum.SUCCESS,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      processedAt: addMinutes(SEED_TIMELINE.seedAt, -8),
    },
    {
      domain: MessageOutboxDomainEnum.CHAT,
      eventType: ChatMessageTypeEnum.SYSTEM,
      bizKey: 'seed:outbox:chat:direct',
      payload: {
        conversationId: conversation.id,
        messageSeq: 3,
      },
      status: MessageOutboxStatusEnum.SUCCESS,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      processedAt: addMinutes(SEED_TIMELINE.seedAt, -7),
    },
  ] as const

  for (const fixture of outboxFixtures) {
    const [existing] = await db
      .select()
      .from(messageOutbox)
      .where(eq(messageOutbox.bizKey, fixture.bizKey))
      .limit(1)

    if (!existing) {
      await db.insert(messageOutbox).values(fixture)
    } else {
      await db
        .update(messageOutbox)
        .set(fixture)
        .where(eq(messageOutbox.id, existing.id))
    }
  }
  console.log('  ✓ Outbox 完成')

  const [existingMetric] = await db
    .select()
    .from(messageWsMetric)
    .where(eq(messageWsMetric.bucketAt, SEED_TIMELINE.chatBucket))
    .limit(1)

  const metricPayload = {
    bucketAt: SEED_TIMELINE.chatBucket,
    requestCount: 6,
    ackSuccessCount: 6,
    ackErrorCount: 0,
    ackLatencyTotalMs: 120n,
    reconnectCount: 1,
    resyncTriggerCount: 1,
    resyncSuccessCount: 1,
  }

  if (!existingMetric) {
    await db.insert(messageWsMetric).values(metricPayload)
  } else {
    await db
      .update(messageWsMetric)
      .set(metricPayload)
      .where(eq(messageWsMetric.id, existingMetric.id))
  }
  console.log('  ✓ WS 指标完成')

  console.log('✅ 消息域数据完成')
}
