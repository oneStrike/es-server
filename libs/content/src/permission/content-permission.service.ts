import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { PurchaseStatusEnum } from '@libs/interaction/purchase'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CHAPTER_PERMISSION_SELECT,
  WORK_PERMISSION_SELECT,
} from './content-permission.select'

interface UserWithLevel {
  id: number
  levelId: number | null
  level: { requiredExperience: number } | null
}

@Injectable()
export class ContentPermissionService extends BaseService {
  get appUser() {
    return this.prisma.appUser
  }

  get work() {
    return this.prisma.work
  }

  get workChapter() {
    return this.prisma.workChapter
  }

  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  get userPurchaseRecord() {
    return this.prisma.userPurchaseRecord
  }

  async resolveWorkPermission(workId: number) {
    const work = await this.work.findUnique({
      where: { id: workId },
      select: WORK_PERMISSION_SELECT,
    })
    if (!work) {
      throw new BadRequestException('作品不存在')
    }
    return {
      ...work,
      viewRule: work.viewRule as WorkViewPermissionEnum,
      requiredExperience: work.requiredViewLevel?.requiredExperience ?? null,
    }
  }

  async resolveChapterPermission(chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: CHAPTER_PERMISSION_SELECT,
    })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (chapter.viewRule === WorkViewPermissionEnum.INHERIT) {
      const workPermission = await this.resolveWorkPermission(chapter.workId)
      return {
        ...workPermission,
        price: workPermission.chapterPrice,
        isPreview: chapter.isPreview,
      }
    }

    return {
      ...chapter,
      viewRule: chapter.viewRule as WorkViewPermissionEnum,
      requiredExperience: chapter.requiredViewLevel?.requiredExperience ?? null,
    }
  }

  private async getUserWithLevel(userId: number) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
      include: {
        level: {
          select: { requiredExperience: true },
        },
      },
    })
    if (!user) {
      throw new BadRequestException('用户不存在')
    }
    return user
  }

  private async validateMemberPermission(
    user: UserWithLevel,
    requiredViewLevelId: number | null,
  ) {
    if (!user.levelId || !user.level) {
      throw new BadRequestException('会员等级不足')
    }

    if (requiredViewLevelId) {
      const requiredLevel = await this.userLevelRule.findUnique({
        where: { id: requiredViewLevelId },
      })
      if (!requiredLevel) {
        throw new BadRequestException('指定的阅读会员等级不存在')
      }
      if (user.level.requiredExperience < requiredLevel.requiredExperience) {
        throw new BadRequestException('会员等级不足')
      }
    }
  }

  private async validateChapterPurchasePermission(
    userId: number,
    chapterId: number,
  ) {
    const purchased = await this.userPurchaseRecord.findFirst({
      where: {
        targetId: chapterId,
        userId,
        status: PurchaseStatusEnum.SUCCESS,
      },
    })
    if (!purchased) {
      throw new BadRequestException('请先购买该章节')
    }
  }

  private async checkWorkAccessPermission(
    viewRule: WorkViewPermissionEnum,
    userId: number,
    requiredViewLevelId: number | null,
  ) {
    if (
      viewRule === WorkViewPermissionEnum.ALL ||
      viewRule === WorkViewPermissionEnum.INHERIT
    ) {
      return true
    }

    const user = await this.getUserWithLevel(userId)

    if (viewRule === WorkViewPermissionEnum.LOGGED_IN) {
      return true
    }

    if (viewRule === WorkViewPermissionEnum.MEMBER) {
      await this.validateMemberPermission(user, requiredViewLevelId)
      return true
    }

    if (viewRule === WorkViewPermissionEnum.PURCHASE) {
      throw new BadRequestException('作品不支持购买权限，请使用会员权限')
    }

    return true
  }

  private async checkChapterAccessPermission(
    viewRule: WorkViewPermissionEnum,
    userId: number,
    requiredViewLevelId: number | null,
    chapterId: number,
    isPreview: boolean,
  ) {
    if (isPreview) {
      return true
    }

    if (
      viewRule === WorkViewPermissionEnum.ALL ||
      viewRule === WorkViewPermissionEnum.INHERIT
    ) {
      return true
    }

    const user = await this.getUserWithLevel(userId)

    if (viewRule === WorkViewPermissionEnum.LOGGED_IN) {
      return true
    }

    if (viewRule === WorkViewPermissionEnum.MEMBER) {
      await this.validateMemberPermission(user, requiredViewLevelId)
      return true
    }

    if (viewRule === WorkViewPermissionEnum.PURCHASE) {
      await this.validateChapterPurchasePermission(userId, chapterId)
      return true
    }

    return true
  }

  async checkWorkAccess(userId: number, workId: number) {
    const { viewRule, requiredViewLevelId } =
      await this.resolveWorkPermission(workId)
    return this.checkWorkAccessPermission(viewRule, userId, requiredViewLevelId)
  }

  async checkChapterAccess(userId: number, chapterId: number) {
    const { viewRule, requiredViewLevelId, isPreview } =
      await this.resolveChapterPermission(chapterId)
    return this.checkChapterAccessPermission(
      viewRule,
      userId,
      requiredViewLevelId,
      chapterId,
      isPreview,
    )
  }

  async checkWorkDownload(userId: number, workId: number) {
    const { viewRule, requiredViewLevelId, canDownload } =
      await this.resolveWorkPermission(workId)
    if (!canDownload) {
      throw new BadRequestException('作品禁止下载')
    }
    return this.checkWorkAccessPermission(viewRule, userId, requiredViewLevelId)
  }

  async checkChapterDownload(userId: number, chapterId: number) {
    const { viewRule, requiredViewLevelId, canDownload } =
      await this.resolveChapterPermission(chapterId)

    if (!canDownload) {
      throw new BadRequestException('章节禁止下载')
    }
    return this.checkChapterAccessPermission(
      viewRule,
      userId,
      requiredViewLevelId,
      chapterId,
      false,
    )
  }
}
