import { RepositoryService } from '@libs/base/database'
import { UpdateStatusDto } from '@libs/base/dto'
import {
  CreateMemberLevelDto,
  UpdateMemberLevelDto,
} from '@libs/member/dto/member-level.dto'
import { Injectable } from '@nestjs/common'

@Injectable()
export class MemberService extends RepositoryService {
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
  async getAllMemberLevels() {
    return this.memberLevel.findMany({
      orderBy: {
        points: 'asc',
      },
      omit: {
        description: true,
      },
    })
  }

  /**
   * 获取会员等级详情
   */
  async getMemberLevelDetail(id: number) {
    return this.memberLevel.findUnique({
      where: {
        id,
      },
    })
  }

  /**
   * 删除会员等级
   */
  async deleteMemberLevel(id: number) {
    return this.memberLevel.delete({
      where: {
        id,
      },
    })
  }

  /**
   * 修改会员等级启用状态
   */
  async changeMemberLevelStatus(statusDto: UpdateStatusDto) {
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
