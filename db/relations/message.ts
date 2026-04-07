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
  messageOutbox: {
    notificationDelivery: r.one.notificationDelivery({
      from: r.messageOutbox.id,
      to: r.notificationDelivery.outboxId,
    }),
  },
  notificationDelivery: {
    outbox: r.one.messageOutbox({
      from: r.notificationDelivery.outboxId,
      to: r.messageOutbox.id,
    }),
    receiverUser: r.one.appUser({
      from: r.notificationDelivery.receiverUserId,
      to: r.appUser.id,
    }),
    notification: r.one.appUserNotification({
      from: r.notificationDelivery.notificationId,
      to: r.appUserNotification.id,
    }),
  },
  appUserNotificationPreference: {
    user: r.one.appUser({
      from: r.appUserNotificationPreference.userId,
      to: r.appUser.id,
      alias: 'AppUserNotificationPreferenceUser',
    }),
  },
  notificationTemplate: {},
  appUserNotification: {
    user: r.one.appUser({
      from: r.appUserNotification.userId,
      to: r.appUser.id,
      alias: 'AppUserNotificationReceiver',
    }),
    actorUser: r.one.appUser({
      from: r.appUserNotification.actorUserId,
      to: r.appUser.id,
      alias: 'AppUserNotificationActor',
    }),
    deliveryRecords: r.many.notificationDelivery({
      from: r.appUserNotification.id,
      to: r.notificationDelivery.notificationId,
    }),
  },
}))
