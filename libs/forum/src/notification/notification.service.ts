import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@app/prisma/prisma.service'
import { RepositoryService } from '@app/base/repository/repository.service'
import { 
  CreateNotificationDto, 
  QueryNotificationListDto, 
  MarkNotificationReadDto,
  BatchMarkNotificationReadDto,
  MarkAllNotificationReadDto,
  DeleteNotificationDto,
  BatchDeleteNotificationDto,
  GetUnreadCountDto
} from './dto/notification.dto'
import { 
  NotificationTypeEnum, 
  NotificationObjectTypeEnum,
  NotificationTitleTemplates,
  NotificationContentTemplates
} from './notification.constant'

@Injectable()
export class NotificationService extends RepositoryService {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.forumNotification, 'forum_notification')
  }

  /**
   * 创建通知
   * @param createNotificationDto 创建通知的数据
   * @returns 创建的通知信息
   */
  async createNotification(createNotificationDto: CreateNotificationDto) {
    const { userId, type, title, content, objectType, objectId } = createNotificationDto

    const profile = await this.prisma.forumProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    return this.prisma.forumNotification.create({
      data: {
        userId,
        type,
        title,
        content,
        objectType,
        objectId,
        isRead: false,
      },
    })
  }

  /**
   * 创建回复通知
   * @param userId 用户ID
   * @param topicId 主题ID
   * @param replyId 回复ID
   * @param replyUserName 回复用户名
   * @param topicTitle 主题标题
   * @returns 创建的通知信息
   */
  async createReplyNotification(
    userId: number,
    topicId: number,
    replyId: number,
    replyUserName: string,
    topicTitle: string,
  ) {
    return this.createNotification({
      userId,
      type: NotificationTypeEnum.REPLY,
      title: NotificationTitleTemplates[NotificationTypeEnum.REPLY],
      content: NotificationContentTemplates[NotificationTypeEnum.REPLY](replyUserName, topicTitle),
      objectType: NotificationObjectTypeEnum.REPLY,
      objectId: replyId,
    })
  }

  /**
   * 创建点赞通知
   * @param userId 用户ID
   * @param objectType 对象类型
   * @param objectId 对象ID
   * @param likeUserName 点赞用户名
   * @returns 创建的通知信息
   */
  async createLikeNotification(
    userId: number,
    objectType: NotificationObjectTypeEnum,
    objectId: number,
    likeUserName: string,
  ) {
    const objectTypeText = objectType === NotificationObjectTypeEnum.TOPIC ? '主题' : '回复'
    return this.createNotification({
      userId,
      type: NotificationTypeEnum.LIKE,
      title: NotificationTitleTemplates[NotificationTypeEnum.LIKE],
      content: NotificationContentTemplates[NotificationTypeEnum.LIKE](likeUserName, objectTypeText),
      objectType,
      objectId,
    })
  }

  /**
   * 创建收藏通知
   * @param userId 用户ID
   * @param topicId 主题ID
   * @param favoriteUserName 收藏用户名
   * @param topicTitle 主题标题
   * @returns 创建的通知信息
   */
  async createFavoriteNotification(
    userId: number,
    topicId: number,
    favoriteUserName: string,
    topicTitle: string,
  ) {
    return this.createNotification({
      userId,
      type: NotificationTypeEnum.FAVORITE,
      title: NotificationTitleTemplates[NotificationTypeEnum.FAVORITE],
      content: NotificationContentTemplates[NotificationTypeEnum.FAVORITE](favoriteUserName, topicTitle),
      objectType: NotificationObjectTypeEnum.TOPIC,
      objectId: topicId,
    })
  }

  /**
   * 创建系统通知
   * @param userId 用户ID
   * @param content 通知内容
   * @returns 创建的通知信息
   */
  async createSystemNotification(userId: number, content: string) {
    return this.createNotification({
      userId,
      type: NotificationTypeEnum.SYSTEM,
      title: NotificationTitleTemplates[NotificationTypeEnum.SYSTEM],
      content: NotificationContentTemplates[NotificationTypeEnum.SYSTEM](content),
      objectType: NotificationObjectTypeEnum.TOPIC,
      objectId: 0,
    })
  }

  /**
   * 查询通知列表
   * @param queryNotificationListDto 查询参数
   * @returns 通知列表
   */
  async queryNotificationList(queryNotificationListDto: QueryNotificationListDto) {
    const { page, pageSize, type, isRead } = queryNotificationListDto

    const where: any = {}

    if (type !== undefined) {
      where.type = type
    }

    if (isRead !== undefined) {
      where.isRead = isRead === 1
    }

    return this.findPagination({
      page,
      pageSize,
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        profile: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
      },
    })
  }

  /**
   * 查询用户通知列表
   * @param userId 用户ID
   * @param queryNotificationListDto 查询参数
   * @returns 通知列表
   */
  async queryUserNotificationList(userId: number, queryNotificationListDto: QueryNotificationListDto) {
    const { page, pageSize, type, isRead } = queryNotificationListDto

    const where: any = {
      userId,
    }

    if (type !== undefined) {
      where.type = type
    }

    if (isRead !== undefined) {
      where.isRead = isRead === 1
    }

    return this.findPagination({
      page,
      pageSize,
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        profile: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
      },
    })
  }

  /**
   * 标记通知已读
   * @param markNotificationReadDto 标记已读的数据
   * @returns 标记结果
   */
  async markNotificationRead(markNotificationReadDto: MarkNotificationReadDto) {
    const { notificationId } = markNotificationReadDto

    const notification = await this.prisma.forumNotification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      throw new BadRequestException('通知不存在')
    }

    if (notification.isRead) {
      throw new BadRequestException('通知已标记为已读')
    }

    return this.prisma.forumNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  /**
   * 批量标记通知已读
   * @param batchMarkNotificationReadDto 批量标记已读的数据
   * @returns 标记结果
   */
  async batchMarkNotificationRead(batchMarkNotificationReadDto: BatchMarkNotificationReadDto) {
    const { notificationIds } = batchMarkNotificationReadDto

    const notifications = await this.prisma.forumNotification.findMany({
      where: {
        id: {
          in: notificationIds,
        },
        isRead: false,
      },
    })

    if (notifications.length === 0) {
      throw new BadRequestException('没有可标记的通知')
    }

    await this.prisma.forumNotification.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return {
      count: notifications.length,
    }
  }

  /**
   * 标记用户所有通知已读
   * @param markAllNotificationReadDto 标记所有已读的数据
   * @returns 标记结果
   */
  async markAllNotificationRead(markAllNotificationReadDto: MarkAllNotificationReadDto) {
    const { userId } = markAllNotificationReadDto

    const notifications = await this.prisma.forumNotification.findMany({
      where: {
        userId,
        isRead: false,
      },
    })

    if (notifications.length === 0) {
      throw new BadRequestException('没有可标记的通知')
    }

    await this.prisma.forumNotification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return {
      count: notifications.length,
    }
  }

  /**
   * 删除通知
   * @param deleteNotificationDto 删除通知的数据
   * @returns 删除结果
   */
  async deleteNotification(deleteNotificationDto: DeleteNotificationDto) {
    const { notificationId } = deleteNotificationDto

    const notification = await this.prisma.forumNotification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      throw new BadRequestException('通知不存在')
    }

    await this.prisma.forumNotification.delete({
      where: { id: notificationId },
    })

    return {
      success: true,
    }
  }

  /**
   * 批量删除通知
   * @param batchDeleteNotificationDto 批量删除通知的数据
   * @returns 删除结果
   */
  async batchDeleteNotification(batchDeleteNotificationDto: BatchDeleteNotificationDto) {
    const { notificationIds } = batchDeleteNotificationDto

    const notifications = await this.prisma.forumNotification.findMany({
      where: {
        id: {
          in: notificationIds,
        },
      },
    })

    if (notifications.length === 0) {
      throw new BadRequestException('没有可删除的通知')
    }

    await this.prisma.forumNotification.deleteMany({
      where: {
        id: {
          in: notificationIds,
        },
      },
    })

    return {
      count: notifications.length,
    }
  }

  /**
   * 获取未读通知数量
   * @param getUnreadCountDto 获取未读数量的数据
   * @returns 未读通知数量
   */
  async getUnreadCount(getUnreadCountDto: GetUnreadCountDto) {
    const { userId } = getUnreadCountDto

    const count = await this.prisma.forumNotification.count({
      where: {
        userId,
        isRead: false,
      },
    })

    return {
      count,
    }
  }

  /**
   * 获取用户未读通知数量
   * @param userId 用户ID
   * @returns 未读通知数量
   */
  async getUserUnreadCount(userId: number) {
    const count = await this.prisma.forumNotification.count({
      where: {
        userId,
        isRead: false,
      },
    })

    return {
      count,
    }
  }
}
