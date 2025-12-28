import { RepositoryService } from '@libs/base/database'
import { IdDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import { Injectable } from '@nestjs/common'
import {
  CreateMemberLevelDto,
  UpdateMemberLevelDto,
} from './dto/member-level.dto'

@Injectable()
export class MemberLevelService extends RepositoryService {
  get memberLevel() {
    return this.prisma.memberLevel
  }

  constructor() {
    super()
  }

  /**
   * 创建会员等级
   */
  async createMemberLevel(createMemberLevelDto: CreateMemberLevelDto) {
    return this.memberLevel.create({
      data: createMemberLevelDto,
    })
  }

  /**
   * 更新会员等级
   */
  async updateMemberLevel(updateMemberLevelDto: UpdateMemberLevelDto) {
    return this.memberLevel.update({
      where: {
        id: updateMemberLevelDto.id,
      },
      data: updateMemberLevelDto,
    })
  }

  /**
   * 获取所有会员等级
   */
  async getMemberLevelList() {
    return this.memberLevel.findMany({
      orderBy: {
        level: 'asc',
      },
      omit: {
        description: true,
        remark: true,
      },
    })
  }

  /**
   * 获取会员等级详情
   */
  async getMemberLevelDetail(dto: IdDto) {
    return this.memberLevel.findUnique({
      where: {
        id: dto.id,
      },
    })
  }

  /**
   * 删除会员等级
   */
  async deleteMemberLevel(dto: IdDto) {
    return this.memberLevel.delete({
      where: {
        id: dto.id,
      },
    })
  }

  /**
   * 修改会员等级启用状态
   */
  async changeMemberLevelStatus(statusDto: UpdateEnabledStatusDto) {
    return this.memberLevel.update({
      where: {
        id: statusDto.id,
      },
      data: {
        isEnabled: statusDto.isEnabled,
      },
    })
  }
}
