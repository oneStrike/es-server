import type { WorkTagWhereInput } from '@libs/platform/database'
import { PlatformService } from '@libs/platform/database'
import { DragReorderDto, IdDto } from '@libs/platform/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CreateTagDto, QueryTagDto, UpdateTagDto } from './dto/tag.dto'

@Injectable()
export class WorkTagService extends PlatformService {
  get workTag() {
    return this.prisma.workTag
  }

  async createTag(createTagDto: CreateTagDto) {
    if (!createTagDto.sortOrder) {
      createTagDto.sortOrder = (await this.workTag.maxOrder()) + 1
    }

    try {
      return await this.workTag.create({
        data: {
          ...createTagDto,
          popularity: 0,
        },
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('Tag name already exists')
        },
      })
    }
  }

  async getTagPage(queryDto: QueryTagDto) {
    const { name, isEnabled, ...pageParams } = queryDto

    const where: WorkTagWhereInput = {}

    if (name) {
      where.name = { contains: name }
    }

    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }

    if (!pageParams.orderBy) {
      pageParams.orderBy = JSON.stringify({ sortOrder: 'desc' })
    }

    return this.workTag.findPagination({
      where: { ...where, ...pageParams },
    })
  }

  async getTagDetail(id: number) {
    const tag = await this.workTag.findUnique({
      where: { id },
    })
    if (!tag) {
      throw new BadRequestException('Tag not found')
    }
    return tag
  }

  async updateTag(updateTagDto: UpdateTagDto) {
    const { id, ...updateData } = updateTagDto

    try {
      await this.workTag.update({
        where: { id },
        data: updateData,
      })

      return { id }
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('Tag name already exists')
        },
        P2025: () => {
          throw new BadRequestException('Tag not found')
        },
      })
    }
  }

  async updateTagSort(updateSortDto: DragReorderDto) {
    return this.workTag.swapField({
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
    })
  }

  async deleteTagBatch(dto: IdDto) {
    if (!(await this.workTag.exists({ id: dto.id }))) {
      throw new BadRequestException('Tag not found')
    }

    if (await this.checkTagHasWorks(dto.id)) {
      throw new BadRequestException('Tag has related works and cannot be deleted')
    }

    await this.workTag.delete({
      where: { id: dto.id },
    })
    return { id: dto.id }
  }

  async checkTagHasWorks(tagId: number) {
    const count = await this.prisma.workTagRelation.count({
      where: {
        tagId,
      },
    })
    return count > 0
  }
}
