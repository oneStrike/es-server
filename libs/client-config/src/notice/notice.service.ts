import {
  ClientNoticeCreateInput,
  ClientNoticeWhereInput,
  BaseService,
} from '@libs/base/database'
import { assertValidTimeRange } from '@libs/base/utils/timeRange'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateNoticeDto,
  QueryNoticeDto,
  UpdateNoticeDto,
} from './dto/notice.dto'

/**
 * 客户端通知模块服务
 */
@Injectable()
export class LibClientNoticeService extends BaseService {
  get clientNotice() {
    return this.prisma.clientNotice
  }

  get clientPage() {
    return this.prisma.clientPage
  }

  constructor() {
    super()
  }

  /**
   * 创建通知
   * @param createNoticeDto 创建通知的数据
   * @returns 创建的通知信息
   */
  async createNotice(createNoticeDto: CreateNoticeDto) {
    // 验证时间范围
    assertValidTimeRange(
      createNoticeDto.publishStartTime,
      createNoticeDto.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    const { pageId, ...others } = createNoticeDto // 明确移除 clientPage
    const createData: ClientNoticeCreateInput = {
      ...others,
    }
    if (pageId) {
      if (!(await this.clientPage.exists({ id: pageId }))) {
        throw new BadRequestException('关联页面不存在')
      } else {
        createData.clientPage = {
          connect: {
            id: pageId,
          },
        }
      }
    }

    return this.clientNotice.create({ data: createData }) // 确保 others 不包含非法字段
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
      pageId,
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
    if (pageId !== undefined) {
      where.pageId = pageId
    }
    if (publishStartTime) {
      where.AND = [{ publishStartTime: { lte: publishStartTime } }]
    }
    if (enablePlatform && enablePlatform !== '[]') {
      where.enablePlatform = {
        hasEvery: JSON.parse(enablePlatform).map((item: string) =>
          Number(item),
        ),
      }
    }
    if (publishEndTime) {
      // 确保 where.AND 是数组类型
      where.AND = Array.isArray(where.AND)
        ? [...where.AND, { publishEndTime: { gte: publishEndTime } }]
        : [{ publishEndTime: { gte: publishEndTime } }]
    }

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
   * 更新通知
   * @param updateNoticeDto 更新数据
   * @returns 更新后的通知信息
   */
  async updateNotice(updateNoticeDto: UpdateNoticeDto) {
    const { id, pageId, ...updateData } = updateNoticeDto

    // 验证时间范围
    assertValidTimeRange(
      updateData.publishStartTime,
      updateData.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    const notice = await this.clientNotice.findUnique({
      where: { id },
      select: { id: true, pageId: true },
    })
    if (!notice) {
      throw new BadRequestException('通知不存在')
    }
    const createData: ClientNoticeCreateInput = {
      ...updateData,
    }
    if (pageId && notice.pageId !== pageId) {
      if (!(await this.clientPage.exists({ id: pageId }))) {
        throw new BadRequestException('关联页面不存在')
      } else {
        createData.clientPage = {
          connect: {
            id: pageId,
          },
        }
      }
    }

    return this.clientNotice.update({
      where: { id },
      data: createData,
      select: { id: true },
    })
  }
}
