import { BaseService } from '@libs/base/database'
import { ContentPermissionService } from '@libs/content/permission'
import { BadRequestException, Injectable } from '@nestjs/common'
import { DownloadTargetTypeEnum } from './download.constant'
import {
  QueryUserDownloadRecordDto,
  UserDownloadRecordKeyDto,
} from './dto/download.dto'

@Injectable()
export class DownloadService extends BaseService {
  constructor(
    private readonly contentPermissionService: ContentPermissionService,
  ) {
    super()
  }

  get userDownloadRecord() {
    return this.prisma.userDownloadRecord
  }

  async downloadTarget(dto: UserDownloadRecordKeyDto) {
    const { targetType, targetId, userId } = dto

    if (
      targetType !== DownloadTargetTypeEnum.COMIC_CHAPTER &&
      targetType !== DownloadTargetTypeEnum.NOVEL_CHAPTER
    ) {
      throw new BadRequestException('不支持的目标类型')
    }

    await this.contentPermissionService.checkChapterDownload(userId, targetId)

    return this.prisma.$transaction(async (tx) => {
      try {
        const record = await tx.userDownloadRecord.create({
          data: dto,
        })

        await tx.workChapter.update({
          where: { id: targetId },
          data: { downloadCount: { increment: 1 } },
        })

        return record
      } catch {
        throw new BadRequestException('下载操作失败，请稍后重试')
      }
    })
  }

  async checkDownloadStatus(dto: UserDownloadRecordKeyDto) {
    return this.userDownloadRecord.exists(dto)
  }

  async checkStatusBatch(
    targetType: DownloadTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const uniqueTargetIds = [...new Set(targetIds)]

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

  async recordDownload(dto: UserDownloadRecordKeyDto) {
    return this.userDownloadRecord.create({
      data: dto,
    })
  }

  async deleteDownloadRecord(id: number) {
    return this.userDownloadRecord.delete({
      where: { id },
    })
  }

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
