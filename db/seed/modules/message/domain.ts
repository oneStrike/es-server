import type { Db } from '../../db-client'
import { and, eq } from 'drizzle-orm'
import { getCanonicalNotificationTemplateContract } from '../../../libs/message/src/notification/notification-template-contract'
import {
  appAnnouncement,
  appUser,
  chatConversation,
  chatConversationMember,
  chatMessage,
  forumTopic,
  messageWsMetric,
  notificationTemplate,
  userComment,
  userNotification,
} from '../../../schema'
import { addMinutes, SEED_ACCOUNTS, SEED_TIMELINE } from '../../shared'

const templateFixtures = [
  'comment_reply',
  'comment_mention',
  'comment_like',
  'topic_like',
  'topic_favorited',
  'topic_commented',
  'topic_mentioned',
  'user_followed',
  'system_announcement',
  'task_reminder',
].map((categoryKey) => {
  const contract = getCanonicalNotificationTemplateContract(categoryKey)
  return {
    categoryKey,
    titleTemplate: contract.titleTemplate,
    contentTemplate: contract.contentTemplate,
    remark: contract.remark,
  }
}) as const

export async function seedMessageDomain(db: Db) {
  console.log('🌱 初始化消息域数据...')

  for (const definition of templateFixtures) {
    const existing = await db.query.notificationTemplate.findFirst({
      where: eq(notificationTemplate.categoryKey, definition.categoryKey),
    })
    const payload = {
      categoryKey: definition.categoryKey,
      titleTemplate: definition.titleTemplate,
      contentTemplate: definition.contentTemplate,
      isEnabled: true,
      remark: definition.remark,
    }

    if (!existing) {
      await db.insert(notificationTemplate).values(payload)
    } else {
      await db
        .update(notificationTemplate)
        .set(payload)
        .where(eq(notificationTemplate.id, existing.id))
    }
  }
  console.log('  ✓ 通知模板完成')

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
      messageType: 1,
      content: '你把进击的巨人前三卷的伏笔整理得很完整。',
      payload: null,
      status: 1,
      createdAt: addMinutes(SEED_TIMELINE.seedAt, -15),
    },
    {
      messageSeq: 2n,
      senderId: userB.id,
      clientMessageId: 'seed-chat-2',
      messageType: 1,
      content: '我后面想把白夜行的人物线也整理成帖子。',
      payload: null,
      status: 1,
      createdAt: addMinutes(SEED_TIMELINE.seedAt, -13),
    },
    {
      messageSeq: 3n,
      senderId: userB.id,
      clientMessageId: 'seed-chat-3',
      messageType: 2,
      content: '今晚如果有空，我们把论坛标签也统一一下。',
      payload: {
        filePath: '/files/chat/image/2026-05-04/seed-chat-640x360.png',
        fileCategory: 'image',
        mimeType: 'image/png',
        fileSize: 20480,
        width: 640,
        height: 360,
        originalName: 'seed-chat.png',
      },
      status: 1,
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
    .sort((left, right) => Number(left.messageSeq - right.messageSeq))
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
      role: 1,
      lastReadMessageId: messageBySeq.get(2n)?.id ?? null,
      lastReadAt: messageBySeq.get(2n)?.createdAt ?? null,
      unreadCount: 1,
      joinedAt: addMinutes(SEED_TIMELINE.seedAt, -20),
    },
    {
      userId: userB.id,
      role: 2,
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
        .where(
          and(
            eq(chatConversationMember.conversationId, conversation.id),
            eq(chatConversationMember.userId, fixture.userId),
          ),
        )
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
  const commentTopic = rootReply?.targetId
    ? await db.query.forumTopic.findFirst({
        where: eq(forumTopic.id, rootReply.targetId),
        columns: {
          id: true,
          userId: true,
          title: true,
          sectionId: true,
        },
      })
    : null
  const topicCommentActor = [userA, userB, userC].find(
    (user) => user.id === rootReply?.userId,
  )
  const topicCommentActorNickname = topicCommentActor?.nickname ?? '有人'

  const notificationFixtures = [
    {
      receiverUserId: commentTopic?.userId ?? userA.id,
      categoryKey: 'topic_commented',
      projectionKey: 'seed:notif:topic-comment:aot',
      actorUserId: rootReply?.userId ?? userB.id,
      title: `${topicCommentActorNickname} 评论了你的主题`,
      content: '我觉得第一卷就把未来冲突埋得很深。',
      payload: {
        object: {
          kind: 'comment',
          id: rootReply?.id ?? 1,
          snippet: '我觉得第一卷就把未来冲突埋得很深。',
        },
        container: {
          kind: 'topic',
          id: commentTopic?.id ?? rootReply?.targetId ?? 1,
          title: commentTopic?.title ?? '进击的巨人：前三卷伏笔整理',
          ...(commentTopic?.sectionId
            ? {
                sectionId: commentTopic.sectionId,
              }
            : {}),
        },
      },
      isRead: false,
      readAt: null,
      expiresAt: null,
    },
    {
      receiverUserId: userB.id,
      categoryKey: 'comment_reply',
      projectionKey: 'seed:notif:comment-reply:aot',
      actorUserId: userA.id,
      title: '小光 回复了你的评论',
      content: '而且艾伦和调查兵团的立场差异很早就有预警。',
      payload: {
        object: {
          kind: 'comment',
          id: replyComment?.id ?? 1,
          snippet: '而且艾伦和调查兵团的立场差异很早就有预警。',
        },
        ...(rootReply
          ? {
              parentComment: {
                kind: 'comment',
                id: rootReply.id,
                snippet: rootReply.content,
              },
            }
          : {}),
        container: {
          kind: 'topic',
          id: commentTopic?.id ?? rootReply?.targetId ?? 1,
          title: commentTopic?.title ?? '进击的巨人：前三卷伏笔整理',
          ...(commentTopic?.sectionId
            ? {
                sectionId: commentTopic.sectionId,
              }
            : {}),
        },
      },
      isRead: false,
      readAt: null,
      expiresAt: null,
    },
    {
      receiverUserId: userC.id,
      categoryKey: 'system_announcement',
      projectionKey: `announcement:notify:${announcement?.id ?? 42}:user:${userC.id}`,
      actorUserId: null,
      title: '春季版本更新公告',
      content: '系统已更新到 2026.03 seed 版本，包含完整联调数据。',
      payload: {
        object: {
          kind: 'announcement',
          id: announcement?.id ?? 42,
          title: announcement?.title ?? '春季版本更新公告',
          ...(announcement?.announcementType !== undefined
            ? { announcementType: announcement.announcementType }
            : {}),
          ...(announcement?.priorityLevel !== undefined
            ? { priorityLevel: announcement.priorityLevel }
            : {}),
          ...(announcement?.summary ? { summary: announcement.summary } : {}),
        },
      },
      isRead: false,
      readAt: null,
      expiresAt: null,
    },
  ] as const

  for (const fixture of notificationFixtures) {
    const existing = await db.query.userNotification.findFirst({
      where: {
        receiverUserId: fixture.receiverUserId,
        projectionKey: fixture.projectionKey,
      },
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
