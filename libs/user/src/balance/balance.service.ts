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
      const beforeBalance = user.balance
      const afterBalance = beforeBalance + amount

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

      await transaction.appUser.update({
        where: { id: userId },
        data: {
          balance: afterBalance,
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
