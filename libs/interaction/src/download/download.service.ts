import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { DownloadTargetTypeEnum } from './download.constant'
import {
  QueryUserDownloadRecordDto,
  UserDownloadRecordKeyDto,
} from './dto/download.dto'

/**
 * `
 * 下载权限配置接口
 * 用于统一处理作品和章节的下载权限校验
 */
interface DownloadPermissionConfig {
  /** 下载规则：0=禁止, 1=所有人, 2=会员, 3=积分 */
  downloadRule: number
  /** 下载所需积分（积分下载时使用） */
  downloadPoints: number | null
  /** 要求的会员等级ID */
  requiredDownloadLevelId: number | null
  /** 要求的会员等级信息 */
  requiredDownloadLevel: { requiredExperience: number } | null
}

/**
 * 下载服务
 * 负责处理作品和章节的下载功能，包括权限校验、下载记录管理、下载统计等
 */
@Injectable()
export class DownloadService extends BaseService {
  constructor() {
    super()
  }

  /** 作品数据访问对象 */
  get work() {
    return this.prisma.work
  }

  /** 章节数据访问对象 */
  get workChapter() {
    return this.prisma.workChapter
  }

  /** 用户数据访问对象 */
  get appUser() {
    return this.prisma.appUser
  }

  /** 用户下载记录数据访问对象 */
  get userDownloadRecord() {
    return this.prisma.userDownloadRecord
  }

  /**
   * 下载目标（作品或章节）
   * @param dto 下载记录DTO，包含 targetType（目标类型）、targetId（目标ID）、userId（用户ID）
   * @returns 下载记录
   * @throws BadRequestException 当目标不存在、禁止下载或权限不足时抛出
   */
  async downloadTarget(dto: UserDownloadRecordKeyDto) {
    const { targetType, targetId, userId } = dto

    // 根据目标类型校验下载权限
    if (
      targetType === DownloadTargetTypeEnum.COMIC_CHAPTER ||
      targetType === DownloadTargetTypeEnum.NOVEL_CHAPTER
    ) {
      await this.validateChapterDownloadPermission(targetId, userId)
    } else if (
      targetType === DownloadTargetTypeEnum.COMIC ||
      targetType === DownloadTargetTypeEnum.NOVEL
    ) {
      await this.validateWorkDownloadPermission(targetId, userId)
    }

    // 使用事务保证一致性：创建下载记录 + 增加下载次数
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.userDownloadRecord.create({
        data: dto,
      })

      if (
        targetType === DownloadTargetTypeEnum.COMIC_CHAPTER ||
        targetType === DownloadTargetTypeEnum.NOVEL_CHAPTER
      ) {
        await tx.workChapter.update({
          where: { id: targetId },
          data: { downloadCount: { increment: 1 } },
        })
      } else if (
        targetType === DownloadTargetTypeEnum.COMIC ||
        targetType === DownloadTargetTypeEnum.NOVEL
      ) {
        await tx.work.update({
          where: { id: targetId },
          data: { downloadCount: { increment: 1 } },
        })
      }

      return record
    })
  }

  /**
   * 校验章节下载权限
   * @param chapterId 章节ID
   * @param userId 用户ID
   * @throws BadRequestException 当章节不存在或权限不足时抛出
   */
  private async validateChapterDownloadPermission(
    chapterId: number,
    userId: number,
  ) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      include: {
        requiredDownloadLevel: true,
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    await this.validateDownloadPermission(
      {
        downloadRule: chapter.downloadRule,
        downloadPoints: chapter.downloadPoints,
        requiredDownloadLevelId: chapter.requiredDownloadLevelId,
        requiredDownloadLevel: chapter.requiredDownloadLevel,
      },
      userId,
      '章节',
    )
  }

  /**
   * 校验作品下载权限
   * @param workId 作品ID
   * @param userId 用户ID
   * @throws BadRequestException 当作品不存在或权限不足时抛出
   */
  private async validateWorkDownloadPermission(workId: number, userId: number) {
    const work = await this.work.findUnique({
      where: { id: workId },
      include: {
        requiredDownloadLevel: true,
      },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    await this.validateDownloadPermission(
      {
        downloadRule: work.downloadRule,
        downloadPoints: work.downloadPoints,
        requiredDownloadLevelId: work.requiredDownloadLevelId,
        requiredDownloadLevel: work.requiredDownloadLevel,
      },
      userId,
      '作品',
    )
  }

  /**
   * 校验下载权限（通用方法）
   * 支持三种权限模式：
   * - 所有人可下载（downloadRule = 1）
   * - 会员可下载（downloadRule = 2），支持指定会员等级
   * - 积分可下载（downloadRule = 3），积分为0时允许下载
   * @param config 下载权限配置
   * @param userId 用户ID
   * @param targetName 目标名称（用于错误提示）
   * @throws BadRequestException 当禁止下载或权限不足时抛出
   */
  private async validateDownloadPermission(
    config: DownloadPermissionConfig,
    userId: number,
    targetName: string,
  ) {
    // 检查是否禁止下载
    if (config.downloadRule === 0) {
      throw new BadRequestException(`该${targetName}禁止下载`)
    }

    // 所有人可下载，无需额外校验
    if (config.downloadRule === WorkViewPermissionEnum.ALL) {
      return
    }

    // 查询用户信息（包含会员等级）
    const user = await this.appUser.findUnique({
      where: { id: userId },
      include: {
        level: true,
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    // 会员权限校验
    if (config.downloadRule === WorkViewPermissionEnum.MEMBER) {
      // 检查用户是否有会员等级
      if (!user.levelId || !user.level) {
        throw new BadRequestException('会员等级不足')
      }

      // 检查用户等级是否满足要求
      if (config.requiredDownloadLevelId && config.requiredDownloadLevel) {
        if (
          user.level.requiredExperience <
            config.requiredDownloadLevel.requiredExperience
        ) {
          throw new BadRequestException('会员等级不足')
        }
      }
    }

    // 积分权限校验
    if (config.downloadRule === WorkViewPermissionEnum.POINTS) {
      const requiredPoints = config.downloadPoints ?? 0
      // 积分为0时允许下载，大于0时校验用户积分
      if (requiredPoints > 0 && user.points < requiredPoints) {
        throw new BadRequestException('积分不足')
      }
    }
  }

  /**
   * 检查用户是否已下载指定目标
   * @param dto 下载记录关键字DTO
   * @returns 是否已下载
   */
  async checkDownloadStatus(dto: UserDownloadRecordKeyDto) {
    return this.userDownloadRecord.exists(dto)
  }

  /**
   * 批量检查用户下载状态
   * @param targetType 目标类型
   * @param targetIds 目标ID数组
   * @param userId 用户ID
   * @returns Map<targetId, 是否已下载>
   */
  async checkStatusBatch(
    targetType: DownloadTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

    // 查询已下载的目标ID
    const downloads = await this.userDownloadRecord.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
        userId,
      },
      select: {
        targetId: true,
      },
    })

    // 构建结果Map
    const downloadedIds = new Set(downloads.map((d) => d.targetId))
    const result = new Map<number, boolean>()

    for (const id of targetIds) {
      result.set(id, downloadedIds.has(id))
    }

    return result
  }

  /**
   * 创建下载记录
   * @param dto 下载记录DTO
   * @returns 下载记录
   */
  async recordDownload(dto: UserDownloadRecordKeyDto) {
    return this.userDownloadRecord.create({
      data: dto,
    })
  }

  /**
   * 删除下载记录
   * 注：下载操作通常不允许取消，此方法主要用于内部管理
   * @param id 下载记录ID
   * @returns 被删除的记录
   */
  protected async deleteDownloadRecord(id: number) {
    return this.prisma.userDownloadRecord.delete({
      where: { id },
    })
  }

  /**
   * 获取用户下载列表（DTO方式）
   * @param dto 查询DTO
   * @returns 分页下载记录列表
   */
  async getUserDownloads(dto: QueryUserDownloadRecordDto) {
    // DTO方式调用
    return this.prisma.userDownloadRecord.findPagination({
      where: dto,
    })
  }
}
