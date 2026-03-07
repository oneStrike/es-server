import type { QueryMyPointRecordDto } from './dto/user-point.dto'
import { BaseService } from '@libs/base/database'
import { UserPointService } from '@libs/user/point'
import { Injectable } from '@nestjs/common'

@Injectable()
export class UserService extends BaseService {
  constructor(private readonly userPointService: UserPointService) {
    super()
  }

  async getUserProfile(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('\u7528\u6237\u4E0D\u5B58\u5728')
    }

    return this.sanitizeUser(user)
  }

  async getUserPoints(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        points: true,
      },
    })

    if (!user) {
      throw new Error('\u7528\u6237\u4E0D\u5B58\u5728')
    }

    return user
  }

  async getUserPointRecords(userId: number, query: QueryMyPointRecordDto) {
    return this.userPointService.getPointRecordPage({
      ...query,
      userId,
    })
  }

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user
    return sanitized
  }
}
