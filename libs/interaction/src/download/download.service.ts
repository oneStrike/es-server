import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { DownloadTargetTypeEnum } from './download.constant'
import {
  BaseUserDownloadRecordDto,
  QueryUserDownloadRecordDto,
} from './dto/download.dto'

/** 下载目标类型 */
type DownloadTargetType = DownloadTargetTypeEnum | number

@Injectable()
export class DownloadService extends BaseService {
  constructor() {
    super()
  }

  get work() {
    return this.prisma.work
  }

  get workChapter() {
    return this.prisma.workChapter
  }

  get userDownloadRecord() {
    return this.prisma.userDownloadRecord
  }

  /**
   * 下载目标
   * @param dto 下载记录DTO，包含 targetType, targetId, userId
   * @returns 下载记录
   * @throws BadRequestException 当目标不存在、禁止下载、权限不足或已下载时抛出
   */
  async downloadTarget(dto: BaseUserDownloadRecordDto) {
    const { targetType, targetId, userId } = dto

    // 1. 检查是否已下载
    const existingDownload = await this.checkUserDownloaded(dto)
    if (existingDownload) {
      throw new BadRequestException('已下载该目标')
    }

    // 2. 根据目标类型校验权限
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

    // 3. 记录下载
    return this.recordDownload(dto)
  }

  /**
   * 校验章节下载权限
   * @param chapterId 章节ID
   * @param userId 用户ID
   * @throws BadRequestException 当权限不足时抛出
   */
  private async validateChapterDownloadPermission(
    chapterId: number,
    userId: number,
  ) {
    // 查询章节信息
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      include: {
        requiredDownloadLevel: true,
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    // 验证是否允许下载
    if (chapter.downloadRule === 0) {
      throw new BadRequestException('该章节禁止下载')
    }

    // 验证下载权限
    if (chapter.downloadRule !== WorkViewPermissionEnum.ALL) {
      // 查询用户信息
      const user = await this.appUser.findUnique({
        where: { id: userId },
        include: {
          level: true,
        },
      })

      if (!user) {
        throw new BadRequestException('用户不存在')
      }

      // 会员权限验证
      if (chapter.downloadRule === WorkViewPermissionEnum.MEMBER) {
        if (!user.levelId || !user.level) {
          throw new BadRequestException('会员等级不足')
        }

        // 验证会员等级要求
        if (chapter.requiredDownloadLevelId) {
          const requiredLevel = chapter.requiredDownloadLevel

          if (!requiredLevel) {
            throw new BadRequestException('指定的下载会员等级不存在')
          }

          if (
            user.level.requiredExperience < requiredLevel.requiredExperience
          ) {
            throw new BadRequestException('会员等级不足')
          }
        }
      }

      // 积分权限验证
      if (chapter.downloadRule === WorkViewPermissionEnum.POINTS) {
        const requiredPoints = chapter.downloadPoints ?? 0
        if (requiredPoints <= 0) {
          throw new BadRequestException('章节未配置下载积分')
        }
        if (user.points < requiredPoints) {
          throw new BadRequestException('积分不足')
        }
      }
    }
  }

  /**
   * 校验作品下载权限
   * @param workId 作品ID
   * @param userId 用户ID
   * @throws BadRequestException 当权限不足时抛出
   */
  private async validateWorkDownloadPermission(workId: number, userId: number) {
    // 查询作品信息
    const work = await this.work.findUnique({
      where: { id: workId },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    // 作品下载权限校验（如有需要可扩展）
    // 目前作品本身没有独立的下载权限字段，依赖于章节权限
  }

  /**
   * 获取应用用户数据访问对象
   */
  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 检查用户是否已下载指定目标
   * @param dto 下载记录DTO，包含 targetType, targetId, userId
   * @returns 是否已下载
   */
  protected async checkUserDownloaded(dto: BaseUserDownloadRecordDto) {
    return this.userDownloadRecord.exists(dto)
  }

  /**
   * 检查用户下载状态
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param userId 用户ID
   * @returns 是否已下载
   */
  async checkDownloadStatus(
    targetType: DownloadTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    return this.userDownloadRecord.exists({
      targetType,
      targetId,
      userId,
    })
  }

  /**
   * 批量检查用户下载状态
   * @param targetType 目标类型
   * @param targetIds 目标ID数组
   * @param userId 用户ID
   * @returns Map<targetId, 是否已下载>
   */
  async checkStatusBatch(
    targetType: DownloadTargetType,
    targetIds: number[],
    userId: number,
  ): Promise<Map<number, boolean>> {
    if (targetIds.length === 0) {
      return new Map()
    }

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

    const downloadedIds = new Set(downloads.map((d) => d.targetId))
    const result = new Map<number, boolean>()

    for (const id of targetIds) {
      result.set(id, downloadedIds.has(id))
    }

    return result
  }

  /**
   * 创建下载记录
   * @param dto 下载记录DTO，包含 targetType, targetId, userId
   */
  async recordDownload(dto: BaseUserDownloadRecordDto): Promise<any>
  /**
   * 创建下载记录（兼容旧版调用方式）
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param userId 用户ID
   * @param workId 作品ID（可选）
   * @param workType 作品类型（可选）
   */
  async recordDownload(
    targetType: DownloadTargetType,
    targetId: number,
    userId: number,
    workId?: number,
    workType?: number,
  ): Promise<any>
  async recordDownload(
    dtoOrTargetType: BaseUserDownloadRecordDto | DownloadTargetType,
    targetId?: number,
    userId?: number,
    workId?: number,
    workType?: number,
  ): Promise<any> {
    // 处理DTO调用方式
    if (typeof dtoOrTargetType === 'object') {
      return this.userDownloadRecord.create({
        data: dtoOrTargetType,
      })
    }

    // 处理多参数调用方式
    return this.userDownloadRecord.create({
      data: {
        targetType: dtoOrTargetType,
        targetId: targetId!,
        userId: userId!,
      },
    })
  }

  /**
   * 删除下载记录
   * 注：下载操作通常不允许取消，此方法主要用于内部管理
   * @param id 下载记录ID
   */
  protected async deleteDownloadRecord(id: number) {
    return this.prisma.userDownloadRecord.delete({
      where: { id },
    })
  }

  /**
   * 获取用户下载列表
   * @param dto 查询DTO
   * @returns 分页下载记录列表
   */
  async getUserDownloads(dto: QueryUserDownloadRecordDto): Promise<any>
  /**
   * 获取用户下载列表（兼容旧版调用方式）
   * @param userId 用户ID
   * @param targetType 目标类型
   * @param pageIndex 页码
   * @param pageSize 每页数量
   * @returns 分页下载记录列表
   */
  async getUserDownloads(
    userId: number,
    targetType: DownloadTargetType,
    pageIndex: number,
    pageSize: number,
  ): Promise<any>
  async getUserDownloads(
    dtoOrUserId: QueryUserDownloadRecordDto | number,
    targetType?: DownloadTargetType,
    pageIndex?: number,
    pageSize?: number,
  ): Promise<any> {
    // 处理多参数调用方式
    if (typeof dtoOrUserId === 'number' && targetType !== undefined) {
      return this.prisma.userDownloadRecord.findPagination({
        where: {
          userId: dtoOrUserId,
          targetType,
        },
        skip: (pageIndex ?? 0) * (pageSize ?? 15),
        take: pageSize ?? 15,
      })
    }

    // 处理DTO调用方式
    return this.prisma.userDownloadRecord.findPagination({
      where: dtoOrUserId as QueryUserDownloadRecordDto,
    })
  }
}
