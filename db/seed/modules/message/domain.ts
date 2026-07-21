import type { MessageNotificationCategoryKey } from '@libs/message/notification/notification.type'
import type { Db } from '../../db-client'
import {
  chatConversation,
  chatConversationMember,
  chatMessage,
  messageWsMetric,
  notificationTemplate,
  userNotification,
} from '@db/schema'
import { getCanonicalNotificationTemplateContract } from '@libs/message/notification/notification-template-contract'
import { and, eq } from 'drizzle-orm'
import { addMinutes, SEED_ACCOUNTS, SEED_TIMELINE } from '../../shared'

const TEMPLATE_CATEGORY_KEYS: readonly MessageNotificationCategoryKey[] = [
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
]

const templateFixtures = TEMPLATE_CATEGORY_KEYS.map((categoryKey) => {
  const contract = getCanonicalNotificationTemplateContract(categoryKey)
  return {
    categoryKey,
    titleTemplate: contract.titleTemplate,
    contentTemplate: contract.contentTemplate,
    remark: contract.remark,
  }
})

export async function seedMessageDomain(db: Db) {
  console.log('🌱 初始化消息域数据...')

  for (const definition of templateFixtures) {
    const existing = await db.query.notificationTemplate.findFirst({
      where: { categoryKey: definition.categoryKey },
      columns: {
        id: true,
      },
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
    where: { account: SEED_ACCOUNTS.readerA },
    columns: {
      id: true,
      nickname: true,
    },
  })
  const userB = await db.query.appUser.findFirst({
    where: { account: SEED_ACCOUNTS.readerB },
    columns: {
      id: true,
      nickname: true,
    },
  })
  const userC = await db.query.appUser.findFirst({
    where: { account: SEED_ACCOUNTS.readerC },
    columns: {
      id: true,
      nickname: true,
    },
  })

  if (!userA || !userB || !userC) {
    console.log('  ℹ 缺少 seed 用户，跳过消息域数据')
    return
  }

  const directPair = [userA.id, userB.id].sort((left, right) => left - right)
  const conversationBizKey = `direct:${directPair[0]}:${directPair[1]}`

  let conversation = await db.query.chatConversation.findFirst({
    where: { bizKey: conversationBizKey },
    columns: {
      id: true,
    },
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
    {
      messageSeq: 4n,
      senderId: userA.id,
      clientMessageId: 'seed-chat-4',
      messageType: 1,
      content: '咒术回战最近的话数作画也太稳了，感觉要追上去。',
      payload: null,
      status: 1,
      createdAt: addMinutes(SEED_TIMELINE.seedAt, -8),
    },
    {
      messageSeq: 5n,
      senderId: userB.id,
      clientMessageId: 'seed-chat-5',
      messageType: 1,
      content: '同感！藤本树的链锯人第二季也快了吧，期待。',
      payload: null,
      status: 1,
      createdAt: addMinutes(SEED_TIMELINE.seedAt, -6),
    },
    {
      messageSeq: 6n,
      senderId: userA.id,
      clientMessageId: 'seed-chat-6',
      messageType: 1,
      content: '葬送的芙莉莲动画做得很舒服，每集都很治愈。',
      payload: null,
      status: 1,
      createdAt: addMinutes(SEED_TIMELINE.seedAt, -4),
    },
    {
      messageSeq: 7n,
      senderId: userB.id,
      clientMessageId: 'seed-chat-7',
      messageType: 1,
      content: '对，节奏控制得很好。你有看间谍过家家吗？',
      payload: null,
      status: 1,
      createdAt: addMinutes(SEED_TIMELINE.seedAt, -2),
    },
  ] as const

  for (const fixture of messageFixtures) {
    const existing = await db.query.chatMessage.findFirst({
      where: {
        AND: [
          { conversationId: conversation.id },
          { messageSeq: fixture.messageSeq },
        ],
      },
      columns: {
        id: true,
      },
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
    where: { conversationId: conversation.id },
    columns: {
      id: true,
      messageSeq: true,
      createdAt: true,
      senderId: true,
    },
  })
  const lastMessage = [...messages]
    .sort((left, right) => Number(left.messageSeq - right.messageSeq))
    .at(-1)

  if (lastMessage) {
    ;[conversation] = await db
      .update(chatConversation)
      .set({
        hasMessages: true,
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
      lastReadMessageId: messageBySeq.get(5n)?.id ?? null,
      lastReadAt: messageBySeq.get(5n)?.createdAt ?? null,
      unreadCount: 2,
      joinedAt: addMinutes(SEED_TIMELINE.seedAt, -20),
    },
    {
      userId: userB.id,
      role: 2,
      lastReadMessageId: messageBySeq.get(7n)?.id ?? null,
      lastReadAt: messageBySeq.get(7n)?.createdAt ?? null,
      unreadCount: 0,
      joinedAt: addMinutes(SEED_TIMELINE.seedAt, -20),
    },
  ] as const

  for (const fixture of memberFixtures) {
    const existing = await db.query.chatConversationMember.findFirst({
      where: {
        AND: [{ conversationId: conversation.id }, { userId: fixture.userId }],
      },
      columns: {
        conversationId: true,
      },
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
    where: { title: '2026 春季版本更新' },
    columns: {
      id: true,
      title: true,
      summary: true,
      announcementType: true,
      priorityLevel: true,
    },
  })
  const rootReply = await db.query.userComment.findFirst({
    where: { content: '我觉得第一卷就把未来冲突埋得很深。' },
    columns: {
      id: true,
      userId: true,
      targetId: true,
      content: true,
    },
  })
  const replyComment = await db.query.userComment.findFirst({
    where: { content: '而且艾伦和调查兵团的立场差异很早就有预警。' },
    columns: {
      id: true,
    },
  })
  const commentTopic = rootReply?.targetId
    ? await db.query.forumTopic.findFirst({
        where: { id: rootReply.targetId },
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
      announcementId: announcement?.id ?? null,
      projectionKey: `announcement:notify:${announcement?.id ?? 42}:user:${userC.id}`,
      actorUserId: null,
      title: '春季版本更新公告',
      content: '系统已更新到 2026.07 版本，包含完整联调数据。',
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
      columns: {
        id: true,
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
    .select({
      id: messageWsMetric.id,
    })
    .from(messageWsMetric)
    .where(eq(messageWsMetric.bucketAt, SEED_TIMELINE.chatBucket))
    .limit(1)

  const metricPayload = {
    bucketAt: SEED_TIMELINE.chatBucket,
    requestCount: 14,
    ackSuccessCount: 14,
    ackErrorCount: 0,
    ackLatencyTotalMs: 280n,
    reconnectCount: 2,
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
