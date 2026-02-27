import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { UserPermissionService } from '@libs/user/permission'
import { BadRequestException, Injectable } from '@nestjs/common'

export interface EffectiveChapterPermission {
  viewRule: WorkViewPermissionEnum
  requiredViewLevelId: number | null
  price: number
  exchangePoints: number
  canExchange: boolean
  canDownload: boolean
}

@Injectable()
export class ContentPermissionService extends BaseService {
  constructor(private readonly userPermissionService: UserPermissionService) {
    super()
  }

  get work() {
    return this.prisma.work
  }

  get workChapterPurchase() {
    return this.prisma.workChapterPurchase
  }

  /**
   * 解析章节有效权限
   * 处理继承逻辑：若章节 viewRule 为 INHERIT (-1)，则继承作品所有配置（包括下载）
   */
  async resolveChapterPermission(
    chapter: {
      workId: number
      viewRule: number
      requiredViewLevelId?: number | null
      price: number
      exchangePoints: number
      canExchange: boolean
      canDownload: boolean
    },
    work?: {
      viewRule: number
      requiredViewLevelId?: number | null
      chapterPrice: number
      chapterExchangePoints: number
      canExchange: boolean
      canDownload: boolean
    } | null,
  ): Promise<EffectiveChapterPermission> {
    if (chapter.viewRule === WorkViewPermissionEnum.INHERIT) {
      const currentWork =
        work ??
        (await this.work.findUnique({
          where: { id: chapter.workId },
        }))

      if (!currentWork) {
        throw new BadRequestException('作品不存在')
      }

      return {
        viewRule: currentWork.viewRule as WorkViewPermissionEnum,
        requiredViewLevelId: currentWork.requiredViewLevelId ?? null,
        price: currentWork.chapterPrice,
        exchangePoints: currentWork.chapterExchangePoints,
        canExchange: currentWork.canExchange,
        canDownload: currentWork.canDownload,
      }
    }

    return {
      viewRule: chapter.viewRule as WorkViewPermissionEnum,
      requiredViewLevelId: chapter.requiredViewLevelId ?? null,
      price: chapter.price,
      exchangePoints: chapter.exchangePoints,
      canExchange: chapter.canExchange,
      canDownload: chapter.canDownload,
    }
  }

  /**
   * 检查章节访问权限
   * 适用于阅读和下载操作
   */
  async checkAccess(
    userId: number,
    chapterId: number,
    permission: EffectiveChapterPermission,
    action: 'view' | 'download',
  ) {
    // 1. 如果是下载操作，先检查下载开关
    if (action === 'download' && !permission.canDownload) {
      throw new BadRequestException('该章节禁止下载')
    }

    // 2. 检查基础阅读权限（登录、会员等级）
    await this.userPermissionService.validateViewPermission(
      permission.viewRule,
      userId,
      permission.requiredViewLevelId,
    )

    // 3. 如果是付费/积分章节，检查购买状态
    if (permission.viewRule === WorkViewPermissionEnum.POINTS) {
      const purchased = await this.workChapterPurchase.findUnique({
        where: {
          chapterId_userId: {
            chapterId,
            userId,
          },
        },
      })

      if (!purchased) {
        throw new BadRequestException('请先购买或兑换该章节')
      }
    }
  }
}
