import {
  BaseService,
  ForumNotificationCreateInput,
} from '@libs/base/database'
import { IdDto, IdsDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateNotificationDto,
  CreateNotificationShortDto,
  ProfileIdDto,
  QueryNotificationListDto,
} from './dto/notification.dto'
import {
  NotificationPriorityEnum,
  NotificationTypeEnum,
} from './notification.constant'

/**
 * 通知服务类
 * 提供论坛通知的创建、查询、标记已读、删除等核心业务逻辑
 */
@Injectable()
export class NotificationService extends BaseService {
  constructor() {
    super()
  }

  get userProfile() {
    return this.prisma.forumProfile
  }

  get notification() {
    return this.prisma.forumNotification
  }

  /**
   * 创建通知
   * @param createNotificationDto 创建通知的数据
   * @returns 创建的通知信息
   */
  async createNotification(createNotificationDto: CreateNotificationDto) {
    if (
      !createNotificationDto.topicId &&
      !createNotificationDto.replyId &&
      createNotificationDto.type !== NotificationTypeEnum.SYSTEM
    ) {
      throw new BadRequestException('通知的主体不存在')
    }

    const profile = await this.userProfile.findUnique({
      where: { id: createNotificationDto.profileId },
      select: {
        user: {
          select: {
            nickname: true,
          },
        },
      },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }
    const createData: ForumNotificationCreateInput = {
      ...createNotificationDto,
      isRead: false,
      profile: {
        connect: {
          id: createNotificationDto.profileId,
        },
      },
    }

    if (createNotificationDto.replyId) {
      createData.reply = {
        connect: {
          id: createNotificationDto.replyId,
        },
      }
    }
    if (createNotificationDto.topicId) {
      createData.topic = {
        connect: {
          id: createNotificationDto.topicId,
        },
      }
    }

    return this.notification.create({ data: createData, select: { id: true } })
  }

  /**
   * 创建回复通知
   * @param dto 创建通知的数据
   * @returns 创建的通知信息
   */
  async createReplyNotification(dto: CreateNotificationShortDto) {
    return this.createNotification({
      ...dto,
      type: NotificationTypeEnum.REPLY,
      priority: NotificationPriorityEnum.NORMAL,
    })
  }

  /**
   * 创建点赞通知
   * @param dto 创建通知的数据
   * @returns 创建的通知信息
   */
  async createLikeNotification(dto: CreateNotificationShortDto) {
    return this.createNotification({
      ...dto,
      type: NotificationTypeEnum.LIKE,
      priority: NotificationPriorityEnum.NORMAL,
    })
  }

  /**
   * 创建收藏通知
   * @param dto 创建通知的数据
   * @returns 创建的通知信息
   */
  async createFavoriteNotification(dto: CreateNotificationShortDto) {
    return this.createNotification({
      ...dto,
      type: NotificationTypeEnum.FAVORITE,
      priority: NotificationPriorityEnum.NORMAL,
    })
  }

  /**
   * 创建系统通知
   * @param dto 创建通知的数据
   * @returns 创建的通知信息
   */
  async createSystemNotification(dto: CreateNotificationShortDto) {
    return this.createNotification({
      ...dto,
      type: NotificationTypeEnum.SYSTEM,
      priority: NotificationPriorityEnum.NORMAL,
    })
  }

  /**
   * 查询通知列表
   * @param queryNotificationListDto 查询参数
   * @returns 通知列表
   */
  async queryNotificationList(
    queryNotificationListDto: QueryNotificationListDto,
  ) {
    return this.notification.findPagination({
      where: queryNotificationListDto,
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
   * @param profileId 用户ID
   * @param queryNotificationListDto 查询参数
   * @returns 通知列表
   */
  async queryUserNotificationList(
    profileId: number,
    queryNotificationListDto: QueryNotificationListDto,
  ) {
    return this.queryNotificationList({
      ...queryNotificationListDto,
      profileId,
    })
  }

  /**
   * 标记通知已读
   * @param dto 标记已读的数据
   * @returns 标记结果
   */
  async markNotificationRead(dto: IdDto) {
    const notification = await this.notification.findUnique({
      where: { id: dto.id },
    })

    if (!notification) {
      throw new BadRequestException('通知不存在')
    }

    if (notification.isRead) {
      throw new BadRequestException('通知已标记为已读')
    }

    return this.notification.update({
      where: { id: dto.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  /**
   * 批量标记通知已读
   * @param dto 批量标记已读的数据
   * @returns 标记结果
   */
  async batchMarkNotificationRead(dto: IdsDto) {
    await this.notification.updateMany({
      where: {
        id: {
          in: dto.ids,
        },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return {
      ids: dto.ids,
    }
  }

  /**
   * 标记用户所有通知已读
   * @param dto 标记所有已读的数据
   * @returns 标记结果
   */
  async markAllNotificationRead(dto: ProfileIdDto) {
    return this.notification.updateMany({
      where: {
        profileId: dto.profileId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  /**
   * 删除通知
   * @param dto 删除通知的数据
   * @returns 删除结果
   */
  async deleteNotification(dto: IdDto) {
    const notification = await this.notification.findUnique({
      where: { id: dto.id },
    })

    if (!notification) {
      throw new BadRequestException('通知不存在')
    }

    return this.notification.delete({
      where: { id: dto.id },
    })
  }

  /**
   * 批量删除通知
   * @param dto 批量删除通知的数据
   * @returns 删除结果
   */
  async batchDeleteNotification(dto: IdsDto) {
    const notifications = await this.notification.findMany({
      where: {
        id: {
          in: dto.ids,
        },
      },
    })

    if (notifications.length === 0) {
      throw new BadRequestException('没有可删除的通知')
    }

    return this.notification.deleteMany({
      where: {
        id: {
          in: dto.ids,
        },
      },
    })
  }

  /**
   * 获取未读通知数量
   * @param dto 获取未读数量的数据
   * @returns 未读通知数量
   */
  async getUnreadCount(dto: ProfileIdDto) {
    return {
      count: await this.notification.count({
        where: {
          profileId: dto.profileId,
          isRead: false,
        },
      }),
    }
  }

  /**
   * 获取用户未读通知数量
   * @param dto 获取用户未读数量的数据
   * @returns 未读通知数量
   */
  async getUserUnreadCount(dto: ProfileIdDto) {
    return {
      count: await this.notification.count({
        where: {
          profileId: dto.profileId,
          isRead: false,
        },
      }),
    }
  }
}
