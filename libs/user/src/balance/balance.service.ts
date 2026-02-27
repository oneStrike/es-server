import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  ChangeUserBalanceDto,
  QueryUserBalanceRecordDto,
} from './dto/balance-record.dto'

@Injectable()
export class UserBalanceService extends BaseService {
  get userBalanceRecord() {
    return this.prisma.userBalanceRecord
  }

  get appUser() {
    return this.prisma.appUser
  }

  async changeBalance(
    dto: ChangeUserBalanceDto,
    tx?: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
  ) {
    const { userId, amount, type, remark } = dto
    const prisma = tx ?? this.prisma
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (amount < 0 && user.balance < Math.abs(amount)) {
      throw new BadRequestException('余额不足')
    }

    if (tx) {
      const beforeBalance = user.balance
      const afterBalance = beforeBalance + amount

      const record = await prisma.userBalanceRecord.create({
        data: {
          userId,
          amount,
          beforeBalance,
          afterBalance,
          type,
          remark,
        },
      })

      await prisma.appUser.update({
        where: { id: userId },
        data: {
          balance: afterBalance,
        },
      })

      return record
    }

    return this.prisma.$transaction(async (transaction) => {
      // 构造更新条件：如果是扣除操作（amount < 0），需要确保余额充足
      const whereCondition: any = { id: userId }
      if (amount < 0) {
        whereCondition.balance = { gte: Math.abs(amount) }
      }

      // 使用 updateMany 带条件作为乐观锁变种，确保余额充足且原子更新
      const updateResult = await transaction.appUser.updateMany({
        where: whereCondition,
        data: {
          balance: {
            increment: amount, // amount 为负数时即为扣除
          },
        },
      })

      if (updateResult.count === 0) {
        throw new BadRequestException('余额不足或用户不存在')
      }

      // 获取更新后的余额用于记录
      const user = await transaction.appUser.findUniqueOrThrow({
        where: { id: userId },
      })

      const afterBalance = user.balance
      const beforeBalance = afterBalance - amount

      const record = await transaction.userBalanceRecord.create({
        data: {
          userId,
          amount,
          beforeBalance,
          afterBalance,
          type,
          remark,
        },
      })

      return record
    })
  }

  async getUserBalanceRecordPage(dto: QueryUserBalanceRecordDto) {
    const { userId, type, ...rest } = dto
    return this.userBalanceRecord.findPagination({
      where: {
        ...(userId && { userId }),
        ...(type !== undefined ? { type } : {}),
        ...rest,
      },
    })
  }

  async getUserBalanceRecordDetail(id: number) {
    const record = await this.userBalanceRecord.findUnique({
      where: { id },
      include: {
        user: true,
      },
    })

    if (!record) {
      throw new BadRequestException('余额记录不存在')
    }

    return record
  }
}
