import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'

@Injectable()
export class UserService extends BaseService {
  async getUserProfile(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('用户不存在')
    }

    return this.sanitizeUser(user)
  }

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user
    return sanitized
  }
}
