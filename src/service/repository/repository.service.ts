import { Inject, Injectable } from '@nestjs/common'
import { CustomPrismaService } from 'nestjs-prisma/dist/custom'
import { PrismaClientType } from '@/prisma/prisma.connect'

@Injectable()
export abstract class RepositoryService {
  @Inject('PrismaService')
  protected prismaService!: CustomPrismaService<PrismaClientType>

  protected get prisma(): PrismaClientType {
    return this.prismaService.client
  }
}
