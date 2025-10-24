import type { AdminUserWhereInput } from '@/prisma/client/models'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { CryptoService } from '@/common/module/crypto/crypto.service'
import { RepositoryService } from '@/common/services/repository.service'
import {
  UpdateUserDto,
  UserPageDto,
  UserRegisterDto,
} from './dto/user.dto'

@Injectable()
export class AdminUserService extends RepositoryService {
  get adminUser() {
    return this.prisma.adminUser
  }

  constructor(private readonly crypto: CryptoService) {
    super()
  }

  /**
   * 更新用户信息
   */
  async updateUserInfo(userId: number, updateData: UpdateUserDto) {
    userId = updateData.id || userId
    // 查找用户
    const user = await this.adminUser.findUnique({
      where: { id: userId },
    })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    // 如果要更新用户名，检查是否已存在
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.adminUser.findUnique({
        where: { username: updateData.username },
      })

      if (existingUser) {
        throw new BadRequestException('用户名已存在')
      }
    }

    // 返回更新后的用户信息（不包含密码）
    return this.adminUser.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
      },
    })
  }

  /**
   * 注册管理员用户
   */
  async register(body: UserRegisterDto) {
    const { username, password, confirmPassword, avatar, role, mobile } = body
    if (password !== confirmPassword) {
      throw new BadRequestException('密码和确认密码不一致')
    }

    // 检查用户名是否已存在
    const existingUser = await this.adminUser.findFirst({
      where: {
        OR: [{ username }, { mobile: body.mobile }],
      },
    })

    if (existingUser) {
      throw new BadRequestException('用户名或手机号已被使用')
    }

    // 加密密码
    const encryptedPassword = await this.crypto.encryptPassword(password)

    // 创建用户
    return this.adminUser.create({
      data: {
        username,
        password: encryptedPassword,
        avatar,
        mobile,
        role: role || 0,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    })
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(userId: number) {
    const user = await this.adminUser.findUnique({
      where: { id: userId },
      omit: {
        password: true,
        isLocked: true,
        loginFailCount: true,
        lastLoginIp: true,
        lastLoginAt: true,
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 返回用户信息（不包含密码）
    return user
  }

  /**
   * 获取用户列表（分页）
   */
  async getUsers(queryDto: UserPageDto) {
    const { username, isEnabled, role } = queryDto

    const where: AdminUserWhereInput = {}

    if (username) {
      where.username = { contains: username }
    }
    if (isEnabled !== undefined) {
      where.isEnabled = { equals: isEnabled }
    }
    if (role !== undefined) {
      where.role = { equals: role }
    }

    return this.adminUser.findPagination({
      where: { ...where, ...queryDto },
      omit: {
        password: true,
        isLocked: true,
        loginFailCount: true,
        lastLoginIp: true,
        lastLoginAt: true,
      },
    })
  }
}
