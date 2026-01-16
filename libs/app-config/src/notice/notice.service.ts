import {
  AppNoticeCreateInput,
  AppNoticeWhereInput,
  BaseService,
} from '@libs/base/database'
import { assertValidTimeRange } from '@libs/base/utils/timeRange'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateNoticeDto,
  QueryNoticeDto,
  UpdateNoticeDto,
} from './dto/notice.dto'

@Injectable()
export class LibAppNoticeService extends BaseService {
  get appNotice() {
    return this.prisma.appNotice
  }

  get appPage() {
    return this.prisma.appPage
  }

  constructor() {
    super()
  }

  async createNotice(createNoticeDto: CreateNoticeDto) {
    assertValidTimeRange(
      createNoticeDto.publishStartTime,
      createNoticeDto.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    const { pageId, ...others } = createNoticeDto
    const createData: AppNoticeCreateInput = {
      ...others,
    }
    if (pageId) {
      if (!(await this.appPage.exists({ id: pageId }))) {
        throw new BadRequestException('关联页面不存在')
      } else {
        createData.appPage = {
          connect: {
            id: pageId,
          },
        }
      }
    }

    return this.appNotice.create({ data: createData })
  }

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

    const where: AppNoticeWhereInput = {}

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
      where.AND = Array.isArray(where.AND)
        ? [...where.AND, { publishEndTime: { gte: publishEndTime } }]
        : [{ publishEndTime: { gte: publishEndTime } }]
    }

    return this.appNotice.findPagination({
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

  async updateNotice(updateNoticeDto: UpdateNoticeDto) {
    const { id, pageId, ...updateData } = updateNoticeDto

    assertValidTimeRange(
      updateData.publishStartTime,
      updateData.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    const notice = await this.appNotice.findUnique({
      where: { id },
      select: { id: true, pageId: true },
    })
    if (!notice) {
      throw new BadRequestException('通知不存在')
    }
    const createData: AppNoticeCreateInput = {
      ...updateData,
    }
    if (pageId && notice.pageId !== pageId) {
      if (!(await this.appPage.exists({ id: pageId }))) {
        throw new BadRequestException('关联页面不存在')
      } else {
        createData.appPage = {
          connect: {
            id: pageId,
          },
        }
      }
    }

    return this.appNotice.update({
      where: { id },
      data: createData,
      select: { id: true },
    })
  }
}
