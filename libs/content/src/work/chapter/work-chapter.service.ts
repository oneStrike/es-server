import { BaseService } from '@libs/base/database'
import { DragReorderDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from './dto/work-chapter.dto'
import { PAGE_WORK_CHAPTER_SELECT } from './work-chapter.select'

@Injectable()
export class WorkChapterService extends BaseService {
  get workChapter() {
    return this.prisma.workChapter
  }

  get work() {
    return this.prisma.work
  }

  get appUser() {
    return this.prisma.appUser
  }

  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  constructor() {
    super()
  }

  async createChapter(createDto: CreateWorkChapterDto) {
    const { workId } = createDto

    if (!(await this.work.exists({ id: workId }))) {
      throw new BadRequestException('关联的作品不存在')
    }

    try {
      return await this.workChapter.create({ data: createDto })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('该作品下章节号已存在')
        },
      })
    }
  }

  async getChapterPage(dto: QueryWorkChapterDto) {
    return this.workChapter.findPagination({
      where: {
        ...dto,
        title: dto.title
          ? {
              contains: dto.title,
              mode: 'insensitive',
            }
          : undefined,
      },
      select: PAGE_WORK_CHAPTER_SELECT,
    })
  }

  async getChapterDetail(id: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id },
      include: {
        work: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        requiredViewLevel: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    return chapter
  }

  async updateChapter(dto: UpdateWorkChapterDto) {
    const { id, ...updateData } = dto
    const { requiredViewLevelId } = updateData

    if (
      requiredViewLevelId
      && !(await this.userLevelRule.exists({ id: requiredViewLevelId }))
    ) {
      throw new BadRequestException('指定的阅读会员等级不存在')
    }

    try {
      return await this.workChapter.update({
        where: { id },
        data: updateData,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('该作品下章节号已存在')
        },
        P2025: () => {
          throw new BadRequestException('章节不存在')
        },
      })
    }
  }

  async deleteChapter(id: number) {
    try {
      return await this.workChapter.delete({ where: { id } })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new BadRequestException('章节不存在')
        },
      })
    }
  }

  async swapChapterNumbers(dto: DragReorderDto) {
    return this.workChapter.swapField({
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'workId',
    })
  }
}
