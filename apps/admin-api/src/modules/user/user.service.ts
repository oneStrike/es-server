import type { AdminUserWhereInput } from '@libs/database/prisma-client/models'
import { ScryptService } from '@libs/crypto'
import { RepositoryService } from '@libs/database'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import {
  ChangePasswordDto,
  UpdateUserDto,
  UserPageDto,
  UserRegisterDto,
} from './dto/user.dto'

@Injectable()
export class UserService extends RepositoryService {
  get adminUser() {
    return this.prisma.adminUser
  }

  constructor(private readonly scryptService: ScryptService) {
    super()
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
      console.warn('用户不存在', { userId })
      throw new NotFoundException('用户不存在')
    }

    // 如果要更新用户名，检查是否已存在
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.adminUser.findUnique({
        where: { username: updateData.username },
        select: { id: true }, // 优化：只查询ID
      })

      if (existingUser) {
        console.warn('用户名已存在', {
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
    console.log('update_user_info success', {
      userId,
      duration,
    })

    return result
  }

  /**
   * 注册管理员用户
   */
  async register(body: UserRegisterDto) {
    const { username, password, confirmPassword, avatar, role, mobile } = body

    if (password !== confirmPassword) {
      throw new BadRequestException('密码和确认密码不一致')
    }

    // 检查用户名是否已存在（优化：使用索引查询）
    const existingUser = await this.adminUser.findFirst({
      where: {
        OR: [{ username }, { mobile }],
      },
      select: { id: true, username: true, mobile: true },
    })

    if (existingUser) {
      throw new BadRequestException('用户名或手机号已被使用')
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
      omit: {
        password: true,
        isLocked: true,
        loginFailCount: true,
        lastLoginIp: true,
        lastLoginAt: true,
        loginFailAt: true,
        loginFailIp: true,
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
      console.warn('新密码和确认密码不一致', { userId })
      throw new BadRequestException('新密码和确认密码不一致')
    }

    // 检查新密码与旧密码是否相同
    if (oldPassword === newPassword) {
      console.warn('新密码与旧密码相同', { userId })
      throw new BadRequestException('新密码不能与旧密码相同')
    }

    // 查找用户（优化：只选择密码字段）
    const user = await this.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })
    if (!user) {
      console.warn('用户不存在', { userId })
      throw new NotFoundException('用户不存在')
    }

    // 验证旧密码
    const isPasswordValid = await this.scryptService.verifyPassword(
      oldPassword,
      user.password,
    )
    if (!isPasswordValid) {
      console.warn('wrong_old_password', { userId })
      throw new UnauthorizedException('旧密码错误')
    }

    // 加密新密码
    const encryptedPassword =
      await this.scryptService.encryptPassword(newPassword)

    // 更新密码
    await this.adminUser.update({
      where: { id: userId },
      data: {
        password: encryptedPassword,
      },
    })

    const duration = Date.now() - startTime
    console.log('change_password success', {
      userId,
      duration,
    })

    return {
      id: userId,
    }
  }

  /**
   * 解锁用户
   */
  async unlockUser(userId: number) {
    // 检查用户是否存在
    const user = await this.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, isLocked: true },
    })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    await this.adminUser.update({
      where: { id: userId },
      data: {
        isLocked: false,
        loginFailAt: null,
        loginFailIp: null,
        loginFailCount: 0,
      },
    })
    return userId
  }

  /**
   * 删除用户
   */
  async deleteUser(id: number) {
    return this.adminUser.delete({ where: { id } })
  }
}
