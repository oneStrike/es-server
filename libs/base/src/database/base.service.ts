import type { PrismaClientType } from './prisma.service'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { CustomPrismaService } from 'nestjs-prisma/dist/custom'

interface PrismaModelWithExists {
  exists: (where: { id: number }) => Promise<boolean>
}

@Injectable()
export abstract class BaseService {
  @Inject('PrismaService')
  protected prismaService!: CustomPrismaService<PrismaClientType>

  protected get prisma(): PrismaClientType {
    return this.prismaService.client
  }

  /**
   * 对外抛出 Http 异常
   */
  protected throwHttpException(message = '数据已存在') {
    throw new BadRequestException(message)
  }

  /**
   * 检查数据是否存在,不存在则抛出异常
   */
  protected async checkDataExists(
    id: number,
    repository: PrismaModelWithExists,
  ) {
    if (!(await repository.exists({ id }))) {
      this.throwHttpException(`ID【${id}】数据不存在`)
    }
  }
}
