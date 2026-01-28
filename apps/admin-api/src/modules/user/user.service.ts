import type { AdminUserWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'
import { ScryptService } from '@libs/base/modules'
import { LoginGuardService } from '@libs/base/modules/auth'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthRedisKeys } from '../auth/auth.constant'
import {
  ChangePasswordDto,
  UpdateUserDto,
  UserPageDto,
  UserRegisterDto,
} from './dto/user.dto'
import { EXCLUDE_USER_FIELDS, UserRoleEnum } from './user.constant'

@Injectable()
export class UserService extends BaseService {
  get adminUser() {
    return this.prisma.adminUser
  }

  constructor(
    private readonly scryptService: ScryptService,
    private readonly configService: ConfigService,
    private readonly loginGuardService: LoginGuardService,
  ) {
    super()
  }

  async isSuperAdmin(userId: number) {
    const adminUser = await this.adminUser.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!adminUser) {
      throw new NotFoundException('用户不存在')
    }

    if (adminUser.role !== UserRoleEnum.SUPER_ADMIN) {
      throw new UnauthorizedException('权限不足')
    }
  }

  /**
   * 更新用户信息
   */
  async updateUserInfo(userId: number, updateData: UpdateUserDto) {
    await this.isSuperAdmin(userId)
    // 查找用户
    const user = await this.adminUser.findUnique({
      where: { id: updateData.id },
      select: { id: true, username: true }, // 优化：只查询需要的字段
    })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 如果要更新用户名，检查是否已存在
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.adminUser.exists({
        username: updateData.username,
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
    if (await this.adminUser.exists({ username })) {
      throw new BadRequestException('用户名已存在')
    }
    // 检查手机号是否已存在
    if (await this.adminUser.exists({ mobile })) {
      throw new BadRequestException('手机号已存在')
    }

    // 加密密码
    const encryptedPassword = await this.scryptService.encryptPassword(password)

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
      omit: EXCLUDE_USER_FIELDS,
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
    const { username, isEnabled, mobile, role, ...pageDto } = queryDto
    const where: AdminUserWhereInput = {}

    if (username) {
      where.username = { contains: username }
    }
    if (mobile) {
      where.mobile = { contains: mobile }
    }
    if (isEnabled !== undefined) {
      where.isEnabled = { equals: isEnabled }
    }
    if (role !== undefined) {
      where.role = { equals: role }
    }

    return this.adminUser.findPagination({
      where: { ...pageDto, ...where },
      omit: EXCLUDE_USER_FIELDS,
    })
  }

  /**
   * 修改密码
   */
  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword, confirmPassword } = changePasswordDto

    // 检查新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('新密码和确认密码不一致')
    }

    // 检查新密码与旧密码是否相同
    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与旧密码相同')
    }

    // 查找用户（优化：只选择密码字段）
    const user = await this.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 验证旧密码
    const isPasswordValid = await this.scryptService.verifyPassword(
      oldPassword,
      user.password,
    )
    if (!isPasswordValid) {
      throw new UnauthorizedException('旧密码错误')
    }

    // 更新密码
    return this.adminUser.update({
      where: { id: userId },
      data: {
        password: await this.scryptService.encryptPassword(newPassword),
      },
      select: { id: true },
    })
  }

  /**
   * 解锁用户
   */
  async unlockUser(userId: number) {
    // 检查用户是否存在
    const user = await this.adminUser.exists({ id: userId })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 解锁用户（清除 Redis 锁）
    await this.loginGuardService.unlock(
      AuthRedisKeys.LOGIN_LOCK(userId),
      AuthRedisKeys.LOGIN_FAIL_COUNT(userId),
    )

    return userId
  }

  /**
   * 重置用户密码为默认密码（Aa@123456）
   */
  async resetPassword(userId: number, id: number) {
    await this.isSuperAdmin(userId)
    // 重置密码为默认密码（Aa@123456）
    const defaultPassword = await this.scryptService.encryptPassword(
      this.configService.get<string>('app.defaultPassword')!,
    )
    await this.adminUser.update({
      where: { id },
      data: {
        password: await this.scryptService.encryptPassword(defaultPassword),
      },
    })
    return userId
  }
}
