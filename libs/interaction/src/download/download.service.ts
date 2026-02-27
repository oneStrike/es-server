import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { DownloadTargetTypeEnum } from './download.constant'
import {
  QueryUserDownloadRecordDto,
  UserDownloadRecordKeyDto,
} from './dto/download.dto'
import { ContentPermissionService } from '@libs/content/permission'

/**
 * 下载服务
 * 负责处理作品和章节的下载功能，包括权限校验、下载记录管理、下载统计等
 */
@Injectable()
export class DownloadService extends BaseService {
  constructor(
    private readonly contentPermissionService: ContentPermissionService,
  ) {
    super()
  }

  /** 用户下载记录数据访问对象 */
  get userDownloadRecord() {
    return this.prisma.userDownloadRecord
  }

  isWorkType(targetType: DownloadTargetTypeEnum) {
    return [
      DownloadTargetTypeEnum.COMIC,
      DownloadTargetTypeEnum.NOVEL,
    ].includes(targetType)
  }

  /**
   * 下载目标（作品或章节）
   * @param dto 下载记录DTO
   * @returns 下载记录
   * @throws BadRequestException 当目标不存在、禁止下载或权限不足时抛出
   */
  async downloadTarget(dto: UserDownloadRecordKeyDto) {
    const { targetType, targetId, userId } = dto

    // 根据目标类型校验下载权限
    if (this.isWorkType(targetType)) {
      await this.contentPermissionService.checkWorkDownload(targetId, userId)
    } else {
      await this.contentPermissionService.checkChapterDownload(targetId, userId)
    }

    // 使用事务保证一致性：创建下载记录 + 增加下载次数
    return this.prisma.$transaction(async (tx) => {
      try {
        const record = await tx.userDownloadRecord.create({
          data: dto,
        })

        if (this.isWorkType(targetType)) {
          await tx.work.update({
            where: { id: targetId },
            data: { downloadCount: { increment: 1 } },
          })
        } else {
          await tx.workChapter.update({
            where: { id: targetId },
            data: { downloadCount: { increment: 1 } },
          })
        }

        return record
      } catch (error) {
        throw new BadRequestException('下载操作失败，请稍后重试')
      }
    })
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

    const uniqueTargetIds = [...new Set(targetIds)]

    // 查询已下载的目标ID
    const downloads = await this.userDownloadRecord.findMany({
      where: {
        targetType,
        targetId: { in: uniqueTargetIds },
        userId,
      },
      select: {
        targetId: true,
      },
    })

    const downloadedIds = new Set(downloads.map((d) => d.targetId))

    const result = new Map<number, boolean>(
      uniqueTargetIds.map((id) => [id, false]),
    )
    for (const id of downloadedIds) {
      result.set(id, true)
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
  async deleteDownloadRecord(id: number) {
    return this.userDownloadRecord.delete({
      where: { id },
    })
  }

  /**
   * 查询用户的下载记录列表
   * @param dto 查询下载记录DTO
   * @returns 下载记录分页列表
   */
  async getUserDownloadRecord(dto: QueryUserDownloadRecordDto) {
    const { userId, targetType, ...restDto } = dto

    return this.userDownloadRecord.findPagination({
      where: {
        ...restDto,
        userId,
        ...(targetType && { targetType }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }
}
