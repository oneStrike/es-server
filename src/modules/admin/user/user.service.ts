import type { AdminUserWhereInput } from '@/prisma/client/models'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { CryptoService } from '@/common/module/crypto/crypto.service'
import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'
import { CustomLoggerService } from '@/common/module/logger/logger.service'
import { RepositoryService } from '@/common/services/repository.service'
import {
  ChangePasswordDto,
  UpdateUserDto,
  UserPageDto,
  UserRegisterDto,
} from './dto/user.dto'

@Injectable()
export class AdminUserService extends RepositoryService {
  private readonly logger: CustomLoggerService

  get adminUser() {
    return this.prisma.adminUser
  }

  constructor(
    private readonly crypto: CryptoService,
    private readonly loggerFactory: LoggerFactoryService,
  ) {
    super()
    this.logger = this.loggerFactory.createAdminLogger('AdminUserService')
  }

  /**
   * 更新用户信息
   */
  async updateUserInfo(userId: number, updateData: UpdateUserDto) {
    const startTime = Date.now()
    userId = updateData.id || userId

    // 查找用户
    const user = await this.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, username: true }, // 优化：只查询需要的字段
    })
    if (!user) {
      this.logger.warn('用户不存在', { userId })
      throw new NotFoundException('用户不存在')
    }

    // 如果要更新用户名，检查是否已存在
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.adminUser.findUnique({
        where: { username: updateData.username },
        select: { id: true }, // 优化：只查询ID
      })

      if (existingUser) {
        this.logger.warn('用户名已存在', {
          userId,
          username: updateData.username,
        })
        throw new BadRequestException('用户名已存在')
      }
    }

    // 返回更新后的用户信息（不包含密码）
    const result = await this.adminUser.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
      },
    })

    const duration = Date.now() - startTime
    this.logger.logBusiness('update_user_info', 'success', {
      userId,
      duration,
    })

    return result
  }

  /**
   * 注册管理员用户
   */
  async register(body: UserRegisterDto) {
    const startTime = Date.now()
    const { username, password, confirmPassword, avatar, role, mobile } = body

    if (password !== confirmPassword) {
      this.logger.warn('密码和确认密码不一致', { username })
      throw new BadRequestException('密码和确认密码不一致')
    }

    // 检查用户名是否已存在（优化：使用索引查询）
    const existingUser = await this.adminUser.findFirst({
      where: {
        OR: [{ username }, { mobile: body.mobile }],
      },
      select: { id: true, username: true, mobile: true }, // 优化：只选择需要的字段
    })

    if (existingUser) {
      this.logger.warn('用户名或手机号已被使用', {
        username,
        mobile,
      })
      throw new BadRequestException('用户名或手机号已被使用')
    }

    // 加密密码
    const encryptedPassword = await this.crypto.encryptPassword(password)

    // 创建用户
    const result = await this.adminUser.create({
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

    const duration = Date.now() - startTime
    this.logger.logBusiness('register_user', 'success', {
      userId: result.id,
      username,
      duration,
    })

    return result
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

  /**
   * 修改密码
   */
  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const startTime = Date.now()
    const { oldPassword, newPassword, confirmPassword } = changePasswordDto

    // 检查新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
      this.logger.warn('新密码和确认密码不一致', { userId })
      throw new BadRequestException('新密码和确认密码不一致')
    }

    // 检查新密码与旧密码是否相同
    if (oldPassword === newPassword) {
      this.logger.warn('新密码与旧密码相同', { userId })
      throw new BadRequestException('新密码不能与旧密码相同')
    }

    // 查找用户（优化：只选择密码字段）
    const user = await this.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })
    if (!user) {
      this.logger.warn('用户不存在', { userId })
      throw new NotFoundException('用户不存在')
    }

    // 验证旧密码
    const isPasswordValid = await this.crypto.verifyPassword(
      oldPassword,
      user.password,
    )
    if (!isPasswordValid) {
      this.logger.logSecurity('wrong_old_password', 'warn', { userId })
      throw new UnauthorizedException('旧密码错误')
    }

    // 加密新密码
    const encryptedPassword = await this.crypto.encryptPassword(newPassword)

    // 更新密码
    await this.adminUser.update({
      where: { id: userId },
      data: {
        password: encryptedPassword,
      },
    })

    const duration = Date.now() - startTime
    this.logger.logBusiness('change_password', 'success', {
      userId,
      duration,
    })

    return {
      id: userId,
    }
  }
}
