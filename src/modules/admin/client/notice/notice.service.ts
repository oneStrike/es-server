import { BadRequestException, Injectable } from '@nestjs/common'
import { RepositoryService } from '@/common/services/repository.service'
import { ClientNoticeWhereInput } from '@/prisma/client/models/ClientNotice'

import { findCombinations } from '@/utils'
import {
  CreateNoticeDto,
  QueryNoticeDto,
  UpdateNoticeDto,
} from './dto/notice.dto'
/**
 * 客户端通知模块服务
 */
@Injectable()
export class ClientNoticeService extends RepositoryService {
  get clientNotice() {
    return this.prisma.clientNotice
  }

  get clientPageConfig() {
    return this.prisma.clientPageConfig
  }

  /**
   * 创建通知
   * @param createNoticeDto 创建通知的数据
   * @returns 创建的通知信息
   */
  async createNotice(createNoticeDto: CreateNoticeDto) {
    // 验证时间范围
    if (createNoticeDto.publishStartTime && createNoticeDto.publishEndTime) {
      if (createNoticeDto.publishStartTime >= createNoticeDto.publishEndTime) {
        throw new BadRequestException('发布开始时间不能大于或等于结束时间')
      }
    }

    const { pageCode, ...others } = createNoticeDto // 明确移除 clientPage
    if (pageCode) {
      const pageInfo = await this.clientNotice.findFirst({
        where: {
          pageCode,
        },
        select: {
          id: true,
        },
      })
      if (!pageInfo) {
        throw new BadRequestException('关联页面不存在')
      } else {
        return this.clientNotice.create({
          data: {
            ...others,
            clientPage: {
              connect: {
                id: pageInfo.id, // 使用 Prisma 的 connect 方法
              },
            },
          },
        })
      }
    }

    return this.clientNotice.create({ data: others }) // 确保 others 不包含非法字段
  }

  /**
   * 分页查询通知列表
   * @param queryNoticeDto 查询条件
   * @returns 分页的通知列表
   */
  async findNoticePage(queryNoticeDto: QueryNoticeDto) {
    const {
      title,
      noticeType,
      priorityLevel,
      isPinned,
      isPublished,
      showAsPopup,
      pageCode,
      publishStartTime,
      publishEndTime,
      enablePlatform,
      ...pageParams
    } = queryNoticeDto

    const where: ClientNoticeWhereInput = {}

    if (title) {
      where.title = { contains: title, mode: 'insensitive' }
    }
    if (noticeType !== undefined) {
      where.noticeType = noticeType
    }
    if (priorityLevel !== undefined) {
      where.priorityLevel = priorityLevel
    }
    if (isPublished !== undefined) {
      where.isPublished = isPublished
    }
    if (isPinned !== undefined) {
      where.isPinned = isPinned
    }
    if (showAsPopup !== undefined) {
      where.showAsPopup = showAsPopup
    }
    if (pageCode !== undefined) {
      where.pageCode = pageCode
    }
    if (publishStartTime) {
      where.AND = [{ publishStartTime: { lte: publishStartTime } }]
    }
    if (enablePlatform) {
      where.enablePlatform = {
        in: findCombinations(enablePlatform.split(','), [1, 2, 4]),
      }
    }
    if (publishEndTime) {
      // 确保 where.AND 是数组类型
      where.AND = Array.isArray(where.AND)
        ? [...where.AND, { publishEndTime: { gte: publishEndTime } }]
        : [{ publishEndTime: { gte: publishEndTime } }]
    }

    console.log('🚀 ~ ClientNoticeService ~ findNoticePage ~ where:', where)

    return this.clientNotice.findPagination({
      where: {
        ...pageParams,
        ...where,
      },
      omit: {
        content: true,
        popupBackgroundImage: true,
      },
    })
  }

  /**
   * 获取有效的通知列表（客户端使用）
   * @param platform 平台类型：applet | web | app
   * @returns 有效的通知列表
   */
  async findActiveNotices(platform: 'applet' | 'web' | 'app' = 'web') {
    const now = new Date()

    // 构建平台筛选条件
    const platformCondition = {
      applet: { enableApplet: true },
      web: { enableWeb: true },
      app: { enableApp: true },
    }[platform]

    return this.clientNotice.findMany({
      where: {
        isPublished: true, // 已发布
        ...platformCondition,
        OR: [
          {
            AND: [
              { publishStartTime: { lte: now } },
              { publishEndTime: { gte: now } },
            ],
          },
          {
            AND: [{ publishStartTime: null }, { publishEndTime: null }],
          },
          {
            AND: [{ publishStartTime: { lte: now } }, { publishEndTime: null }],
          },
          {
            AND: [{ publishStartTime: null }, { publishEndTime: { gte: now } }],
          },
        ],
      },
      orderBy: [
        { isPinned: 'desc' },
        { priorityLevel: 'desc' },
        { order: 'desc' },
        { createdAt: 'desc' },
      ],
      omit: {
        content: true,
        popupBackgroundImage: true,
      },
    })
  }

  /**
   * 更新通知
   * @param updateNoticeDto 更新数据
   * @returns 更新后的通知信息
   */
  async updateNotice(updateNoticeDto: UpdateNoticeDto) {
    const { id, pageCode, ...updateData } = updateNoticeDto

    // 验证时间范围
    if (updateData.publishStartTime && updateData.publishEndTime) {
      if (updateData.publishStartTime >= updateData.publishEndTime) {
        throw new BadRequestException('发布开始时间不能大于或等于结束时间')
      }
    }

    const notice = await this.clientNotice.findUnique({ where: { id } })
    if (!notice) {
      throw new BadRequestException('通知不存在')
    }
    if (pageCode && notice.pageCode !== pageCode) {
      const pageInfo = await this.clientPageConfig.findFirst({
        where: {
          pageCode,
        },
        select: {
          id: true,
        },
      })
      if (!pageInfo) {
        throw new BadRequestException('关联页面不存在')
      } else {
        return this.clientNotice.update({
          where: { id },
          data: {
            ...updateData,
            clientPage: {
              connect: {
                id: pageInfo.id,
              },
            },
          },
        })
      }
    }

    return this.clientNotice.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 增加通知阅读次数
   * @param id 通知ID
   * @returns 更新后的阅读次数
   */
  async incrementViewCount(id: number) {
    // 验证通知是否存在且已发布
    const notice = await this.clientNotice.findFirst({
      where: {
        id,
        isPublished: true,
      },
    })

    if (!notice) {
      throw new BadRequestException('通知不存在或未发布')
    }

    // 原子性更新阅读次数
    return this.clientNotice.update({
      where: { id },
      data: {
        readCount: {
          increment: 1,
        },
      },
      select: {
        id: true,
        readCount: true,
      },
    })
  }
}
