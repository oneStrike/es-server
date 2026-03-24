import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema/index'

export const messageRelations = defineRelationsPart(schema, (r) => ({
  chatConversation: {
    lastMessage: r.one.chatMessage({
      from: r.chatConversation.lastMessageId,
      to: r.chatMessage.id,
      alias: 'ChatConversationLastMessage',
    }),
    lastSender: r.one.appUser({
      from: r.chatConversation.lastSenderId,
      to: r.appUser.id,
      alias: 'ChatConversationLastSender',
    }),
    conversationMembers: r.many.chatConversationMember(),
    participants: r.many.appUser({
      from: r.chatConversation.id.through(
        r.chatConversationMember.conversationId,
      ),
      to: r.appUser.id.through(r.chatConversationMember.userId),
      alias: 'ChatConversationParticipants',
    }),
    messages: r.many.chatMessage(),
  },
  chatConversationMember: {
    conversation: r.one.chatConversation({
      from: r.chatConversationMember.conversationId,
      to: r.chatConversation.id,
    }),
    lastReadMessage: r.one.chatMessage({
      from: r.chatConversationMember.lastReadMessageId,
      to: r.chatMessage.id,
      alias: 'ChatConversationMemberLastReadMessage',
    }),
    user: r.one.appUser({
      from: r.chatConversationMember.userId,
      to: r.appUser.id,
      alias: 'ChatConversationMemberUser',
    }),
  },
  chatMessage: {
    conversation: r.one.chatConversation({
      from: r.chatMessage.conversationId,
      to: r.chatConversation.id,
    }),
    sender: r.one.appUser({
      from: r.chatMessage.senderId,
      to: r.appUser.id,
      alias: 'ChatMessageSender',
    }),
  },
  userNotification: {
    user: r.one.appUser({
      from: r.userNotification.userId,
      to: r.appUser.id,
      alias: 'UserNotificationReceiver',
    }),
    actorUser: r.one.appUser({
      from: r.userNotification.actorUserId,
      to: r.appUser.id,
      alias: 'UserNotificationActor',
    }),
  },
}))
