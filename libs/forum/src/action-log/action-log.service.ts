import { BaseService } from '@libs/base/database'

import { Injectable } from '@nestjs/common'
import { ForumUserActionTypeDescriptionMap } from './action-log.constant'
import {
  CreateForumActionLogDto,
  QueryForumActionLogDto,
} from './dto/action-log.dto'

/**
 * 论坛用户操作日志服务类
 * 提供用户操作日志的记录、查询等核心业务逻辑
 */
@Injectable()
export class ForumUserActionLogService extends BaseService {
  get forumUserActionLog() {
    return this.prisma.forumUserActionLog
  }

  /**
   * 创建用户操作日志
   * @param options - 操作日志选项对象
   * @returns 创建的操作日志记录
   */
  async createActionLog(options: CreateForumActionLogDto) {
    const {
      profileId,
      actionType,
      targetType,
      targetId,
      beforeData,
      afterData,
      ipAddress,
      userAgent,
    } = options

    return this.forumUserActionLog.create({
      data: {
        profileId,
        actionType,
        actionDescription: ForumUserActionTypeDescriptionMap[actionType],
        targetType,
        targetId,
        beforeData: beforeData
          ? typeof beforeData === 'string'
            ? beforeData
            : JSON.stringify(beforeData)
          : null,
        afterData: afterData
          ? typeof afterData === 'string'
            ? afterData
            : JSON.stringify(afterData)
          : null,
        ipAddress,
        userAgent,
      },
    })
  }

  /**
   * 根据用户资料ID查询操作日志（分页）
   * @param options - 查询选项对象
   * @returns 操作日志分页结果，包含列表、总数、页码和每页数量
   */
  async getActionLogsByProfileId(dto: QueryForumActionLogDto) {
    const { profileId, ...otherDto } = dto
    return this.forumUserActionLog.findPagination({
      where: {
        profile: {
          id: profileId,
        },
        ...otherDto,
      },
    })
  }
}
