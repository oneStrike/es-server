import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  exists,
  findPagination,
  maxOrder,
  softDelete,
  swapField,
} from './extensions'
import { PrismaClient } from './index'

export function makePrismaClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter }).$extends({
    model: {
      $allModels: {
        exists,
        ...softDelete,
        findPagination,
        maxOrder,
        swapField,
      },
    },
  })
}
export type PrismaClientType = ReturnType<typeof makePrismaClient>

@Injectable()
export class PrismaService implements OnApplicationShutdown {
  public readonly client: PrismaClientType

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.client = makePrismaClient(
      this.configService.get('db.connection') as string,
    )
  }

  createPrismaClient(): PrismaClientType {
    return this.client
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect()
  }
}
