import { RepositoryService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  AuditObjectTypeEnum,
  AuditStatusEnum,
} from '../audit.constant'
import {
  BatchApproveDto,
  BatchRejectDto,
  CreateSensitiveWordDto,
  DeleteSensitiveWordDto,
  QueryAuditHistoryDto,
  QueryAuditQueueDto,
  QuerySensitiveWordDto,
  UpdateSensitiveWordDto,
} from './dto/audit.dto'

@Injectable()
export class AuditService extends RepositoryService {
  get forumSensitiveWord() {
    return this.prisma.forumSensitiveWord
  }

  get forumAuditLog() {
    return this.prisma.forumAuditLog
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  get clientUser() {
    return this.prisma.clientUser
  }

  /**
   * 创建敏感词
   * @param createDto 创建参数
   * @returns 创建结果
   */
  async createSensitiveWord(createDto: CreateSensitiveWordDto) {
    const { word, replaceWord, isEnabled = true, remark } = createDto

    const existing = await this.forumSensitiveWord.findUnique({
      where: { word },
    })

    if (existing) {
      throw new BadRequestException('敏感词已存在')
    }

    return this.forumSensitiveWord.create({
      data: {
        word,
        replaceWord,
        isEnabled,
        remark,
      },
    })
  }

  /**
   * 更新敏感词
   * @param updateDto 更新参数
   * @returns 更新结果
   */
  async updateSensitiveWord(updateDto: UpdateSensitiveWordDto) {
    const { id, replaceWord, isEnabled, remark } = updateDto

    const sensitiveWord = await this.forumSensitiveWord.findUnique({
      where: { id },
    })

    if (!sensitiveWord) {
      throw new BadRequestException('敏感词不存在')
    }

    const updateData: any = {}

    if (replaceWord !== undefined) {
      updateData.replaceWord = replaceWord
    }

    if (typeof isEnabled === 'boolean') {
      updateData.isEnabled = isEnabled
    }

    if (remark !== undefined) {
      updateData.remark = remark
    }

    return this.forumSensitiveWord.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除敏感词
   * @param deleteDto 删除参数
   * @returns 删除结果
   */
  async deleteSensitiveWord(deleteDto: DeleteSensitiveWordDto) {
    const { id } = deleteDto

    const sensitiveWord = await this.forumSensitiveWord.findUnique({
      where: { id },
    })

    if (!sensitiveWord) {
      throw new BadRequestException('敏感词不存在')
    }

    await this.forumSensitiveWord.delete({
      where: { id },
    })

    return true
  }

  /**
   * 分页查询敏感词列表
   * @param queryDto 查询参数
   * @returns 敏感词列表
   */
  async getSensitiveWordPage(queryDto: QuerySensitiveWordDto) {
    const {
      word,
      isEnabled,
      page = 1,
      pageSize = 20,
    } = queryDto

    const where: any = {}

    if (word) {
      where.word = {
        contains: word,
        mode: 'insensitive',
      }
    }

    if (typeof isEnabled === 'boolean') {
      where.isEnabled = isEnabled
    }

    return this.forumSensitiveWord.findPagination({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      page,
      pageSize,
    })
  }

  /**
   * 分页查询审核队列
   * @param queryDto 查询参数
   * @returns 审核队列列表
   */
  async getAuditQueuePage(queryDto: QueryAuditQueueDto) {
    const {
      objectType,
      auditStatus = AuditStatusEnum.PENDING,
      startTime,
      endTime,
      page = 1,
      pageSize = 20,
    } = queryDto

    const where: any = {}

    if (objectType) {
      where.objectType = objectType
    }

    if (auditStatus !== undefined) {
      where.auditStatus = auditStatus
    }

    if (startTime || endTime) {
      where.createdAt = {}
      if (startTime) {
        where.createdAt.gte = new Date(startTime)
      }
      if (endTime) {
        where.createdAt.lte = new Date(endTime)
      }
    }

    const result = await this.forumAuditLog.findPagination({
      where,
      include: {
        topic: {
          include: {
            profile: {
              include: {
                user: true,
              },
            },
          },
        },
        reply: {
          include: {
            profile: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      page,
      pageSize,
    })

    const list = result.list.map((log) => {
      let content = ''
      let authorId = 0
      let authorUsername = ''

      if (log.objectType === AuditObjectTypeEnum.TOPIC && log.topic) {
        content = log.topic.title
        authorId = log.topic.profile.userId
        authorUsername = log.topic.profile.user.username
      } else if (log.objectType === AuditObjectTypeEnum.REPLY && log.reply) {
        content = log.reply.content
        authorId = log.reply.profile.userId
        authorUsername = log.reply.profile.user.username
      }

      return {
        id: log.id,
        objectType: log.objectType,
        objectTypeName: AuditObjectTypeEnum[log.objectType],
        objectId: log.objectId,
        content,
        authorId,
        authorUsername,
        auditStatus: log.auditStatus,
        auditStatusName: AuditStatusEnum[log.auditStatus],
        auditReason: log.auditReason,
        auditBy: log.auditBy,
        auditAt: log.auditAt,
        createdAt: log.createdAt,
      }
    })

    return {
      ...result,
      list,
    }
  }

  /**
   * 批量通过
   * @param approveDto 审核参数
   * @returns 审核结果
   */
  async batchApprove(approveDto: BatchApproveDto) {
    const { ids } = approveDto

    for (const id of ids) {
      const auditLog = await this.forumAuditLog.findUnique({
        where: { id },
      })

      if (!auditLog) {
        throw new BadRequestException(`审核日志ID ${id} 不存在`)
      }

      if (auditLog.auditStatus !== AuditStatusEnum.PENDING) {
        throw new BadRequestException(`审核日志ID ${id} 不是待审核状态`)
      }
    }

    await this.forumAuditLog.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        auditStatus: AuditStatusEnum.APPROVED,
        auditAt: new Date(),
      },
    })

    return true
  }

  /**
   * 批量拒绝
   * @param rejectDto 审核参数
   * @returns 审核结果
   */
  async batchReject(rejectDto: BatchRejectDto) {
    const { ids, reason } = rejectDto

    for (const id of ids) {
      const auditLog = await this.forumAuditLog.findUnique({
        where: { id },
      })

      if (!auditLog) {
        throw new BadRequestException(`审核日志ID ${id} 不存在`)
      }

      if (auditLog.auditStatus !== AuditStatusEnum.PENDING) {
        throw new BadRequestException(`审核日志ID ${id} 不是待审核状态`)
      }
    }

    await this.forumAuditLog.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        auditStatus: AuditStatusEnum.REJECTED,
        auditReason: reason,
        auditAt: new Date(),
      },
    })

    return true
  }

  /**
   * 分页查询审核历史
   * @param queryDto 查询参数
   * @returns 审核历史列表
   */
  async getAuditHistoryPage(queryDto: QueryAuditHistoryDto) {
    const {
      objectType,
      auditStatus,
      auditBy,
      startTime,
      endTime,
      page = 1,
      pageSize = 20,
    } = queryDto

    const where: any = {}

    if (objectType) {
      where.objectType = objectType
    }

    if (auditStatus !== undefined) {
      where.auditStatus = auditStatus
    }

    if (auditBy) {
      where.auditBy = auditBy
    }

    if (startTime || endTime) {
      where.auditAt = {}
      if (startTime) {
        where.auditAt.gte = new Date(startTime)
      }
      if (endTime) {
        where.auditAt.lte = new Date(endTime)
      }
    }

    const result = await this.forumAuditLog.findPagination({
      where,
      include: {
        topic: {
          include: {
            profile: {
              include: {
                user: true,
              },
            },
          },
        },
        reply: {
          include: {
            profile: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        auditAt: 'desc',
      },
      page,
      pageSize,
    })

    const list = result.list.map((log) => {
      let content = ''
      let authorId = 0
      let authorUsername = ''

      if (log.objectType === AuditObjectTypeEnum.TOPIC && log.topic) {
        content = log.topic.title
        authorId = log.topic.profile.userId
        authorUsername = log.topic.profile.user.username
      } else if (log.objectType === AuditObjectTypeEnum.REPLY && log.reply) {
        content = log.reply.content
        authorId = log.reply.profile.userId
        authorUsername = log.reply.profile.user.username
      }

      let auditByUsername = ''
      if (log.auditBy) {
        const auditUser = this.clientUser.findUnique({
          where: { id: log.auditBy },
        })
        if (auditUser) {
          auditByUsername = (auditUser as any).username
        }
      }

      return {
        id: log.id,
        objectType: log.objectType,
        objectTypeName: AuditObjectTypeEnum[log.objectType],
        objectId: log.objectId,
        content,
        authorId,
        authorUsername,
        auditStatus: log.auditStatus,
        auditStatusName: AuditStatusEnum[log.auditStatus],
        auditReason: log.auditReason,
        auditBy: log.auditBy,
        auditByUsername,
        auditAt: log.auditAt,
        createdAt: log.createdAt,
      }
    })

    return {
      ...result,
      list,
    }
  }

  /**
   * 敏感词过滤
   * @param content 内容
   * @returns 过滤后的内容
   */
  async filterSensitiveWords(content: string): Promise<string> {
    const sensitiveWords = await this.forumSensitiveWord.findMany({
      where: {
        isEnabled: true,
      },
    })

    let filteredContent = content

    for (const sensitiveWord of sensitiveWords) {
      const regex = new RegExp(sensitiveWord.word, 'gi')
      filteredContent = filteredContent.replace(regex, sensitiveWord.replaceWord || '***')
    }

    return filteredContent
  }
}
