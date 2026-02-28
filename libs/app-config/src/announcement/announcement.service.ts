import {
  AppAnnouncementCreateInput,
  AppAnnouncementWhereInput,
  BaseService,
} from '@libs/base/database'
import { assertValidTimeRange } from '@libs/base/utils/timeRange'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateAnnouncementDto,
  QueryAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto'

/**
 * 系统公告服务
 * 负责公告的创建、查询与更新
 */
@Injectable()
export class AppAnnouncementService extends BaseService {
  get appAnnouncement() {
    return this.prisma.appAnnouncement
  }

  get appPage() {
    return this.prisma.appPage
  }

  constructor() {
    super()
  }

  /**
   * 创建公告
   * @param createAnnouncementDto 创建数据
   * @returns 创建后的公告记录
   */
  async createAnnouncement(createAnnouncementDto: CreateAnnouncementDto) {
    assertValidTimeRange(
      createAnnouncementDto.publishStartTime,
      createAnnouncementDto.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    const { pageId, ...others } = createAnnouncementDto
    const createData: AppAnnouncementCreateInput = {
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

    return this.appAnnouncement.create({ data: createData })
  }

  /**
   * 分页查询公告
   * @param queryAnnouncementDto 查询条件
   * @returns 分页结果
   */
  async findAnnouncementPage(queryAnnouncementDto: QueryAnnouncementDto) {
    const {
      title,
      publishStartTime,
      enablePlatform,
      publishEndTime,
      ...pageParams
    } = queryAnnouncementDto

    const where: AppAnnouncementWhereInput = {}

    if (title) {
      where.title = { contains: title, mode: 'insensitive' }
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

    return this.appAnnouncement.findPagination({
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
   * 更新公告
   * @param updateAnnouncementDto 更新数据
   * @returns 更新后的公告记录
   */
  async updateAnnouncement(updateAnnouncementDto: UpdateAnnouncementDto) {
    const { id, pageId, ...updateData } = updateAnnouncementDto

    assertValidTimeRange(
      updateData.publishStartTime,
      updateData.publishEndTime,
      '发布开始时间不能大于或等于结束时间',
    )

    const announcement = await this.appAnnouncement.findUnique({
      where: { id },
      select: { id: true, pageId: true },
    })
    if (!announcement) {
      throw new BadRequestException('公告不存在')
    }
    const createData: AppAnnouncementCreateInput = {
      ...updateData,
    }
    if (pageId && announcement.pageId !== pageId) {
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

    return this.appAnnouncement.update({
      where: { id },
      data: createData,
      select: { id: true },
    })
  }

  /**
   * 获取公告详情
   * @param id 公告ID
   * @returns 公告详情
   */
  async findAnnouncementDetail(id: number) {
    return this.appAnnouncement.findUnique({
      where: { id },
      include: {
        appPage: {
          select: {
            id: true,
            code: true,
            name: true,
            path: true,
          },
        },
      },
    })
  }

  /**
   * 增加浏览量
   * @param id 公告ID
   */
  async incrementViewCount(id: number) {
    return this.appAnnouncement.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })
  }
}
