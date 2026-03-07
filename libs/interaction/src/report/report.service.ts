import type {
  CreateUserReportDto,
  CreateUserReportOptions,
} from './dto/report.dto'
import { ReportStatusEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'

@Injectable()
export class ReportService extends BaseService {
  private get userReport() {
    return this.prisma.userReport
  }

  private isDuplicateError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    )
  }

  async createReport(
    dto: CreateUserReportDto,
    options: CreateUserReportOptions = {},
  ) {
    const { status, ...otherDto } = dto

    try {
      return await this.userReport.create({
        data: {
          ...otherDto,
          status: status ?? ReportStatusEnum.PENDING,
        },
      })
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new BadRequestException(
          options.duplicateMessage ?? '您已经举报过该内容，请勿重复举报',
        )
      }
      throw error
    }
  }

  async getReportById(
    id: number,
    options?: {
      include?: any
      select?: any
    },
  ) {
    return this.userReport.findUnique({
      where: { id },
      ...(options ?? {}),
    })
  }

  async queryReportPage(options: any) {
    return this.userReport.findPagination(options)
  }

  async updateReport(id: number, data: Record<string, unknown>) {
    return this.userReport.update({
      where: { id },
      data,
    })
  }

  async deleteReport(id: number) {
    return this.userReport.delete({
      where: { id },
    })
  }

  async countReports(where?: Record<string, unknown>) {
    return this.userReport.count({ where })
  }

  async groupReportsBy(options: any) {
    return this.userReport.groupBy(options)
  }
}
