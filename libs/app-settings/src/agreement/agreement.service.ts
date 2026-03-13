import {
  AppAgreementUpdateInput,
  AppAgreementWhereInput,
  PlatformService,
} from '@libs/platform/database'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CreateAgreementDto,
  QueryAgreementDto,
  QueryPublishedAgreementDto,
  UpdateAgreementDto,
} from './dto/agreement.dto'

@Injectable()
export class AgreementService extends PlatformService {
  constructor() {
    super()
  }

  get agreement() {
    return this.prisma.appAgreement
  }

  get agreementLog() {
    return this.prisma.appAgreementLog
  }

  async create(dto: CreateAgreementDto) {
    try {
      return await this.agreement.create({
        data: {
          title: dto.title,
          content: dto.content,
          version: dto.version,
          isForce: dto.isForce ?? false,
          showInAuth: dto.showInAuth ?? false,
        },
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('协议已存在')
        },
      })
    }
  }

  async update(dto: UpdateAgreementDto) {
    const data: AppAgreementUpdateInput = {
      ...dto,
    }

    if (dto.isPublished === true) {
      data.publishedAt = new Date()
    }

    try {
      return await this.agreement.update({
        where: { id: dto.id },
        data,
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('协议不存在')
        },
      })
    }
  }

  async updatePublishStatus(dto: UpdatePublishedStatusDto) {
    try {
      return await this.agreement.update({
        where: { id: dto.id },
        data: { isPublished: dto.isPublished },
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('协议不存在')
        },
      })
    }
  }

  async delete({ id }: IdDto) {
    try {
      return await this.agreement.delete({ where: { id }, select: { id: true } })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('协议不存在')
        },
      })
    }
  }

  async findOne({ id }: IdDto) {
    const agreement = await this.agreement.findUnique({
      where: { id },
    })
    if (!agreement) {
      throw new NotFoundException('协议不存在')
    }
    return agreement
  }

  async findPage(query: QueryAgreementDto) {
    const { title, ...otherDto } = query
    const where: AppAgreementWhereInput = {}

    if (title) {
      where.title = {
        contains: title,
      }
    }

    return this.agreement.findPagination({
      where: { title, ...otherDto },
      omit: { content: true },
    })
  }

  async getAllLatest(dto: QueryPublishedAgreementDto) {
    return this.agreement.findMany({
      where: { isPublished: true, showInAuth: dto.showInAuth },
      omit: { content: true },
    })
  }
}
