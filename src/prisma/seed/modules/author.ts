import type { PrismaClient } from '@prisma/client'
import { AuthorGenderEnum } from '../../../modules/admin/work/author/author.constant'

export async function createInitialAuthors(prisma: PrismaClient) {
  // 首先获取角色类型映射
  const roleTypes = await prisma.workAuthorRoleType.findMany({
    select: { id: true, code: true },
  })
  const roleTypeMap = Object.fromEntries(
    roleTypes.map((rt) => [rt.code, rt.id]),
  )

  const initData = [
    {
      name: '村上春树',
      avatar: 'https://example.com/avatars/haruki-murakami.jpg',
      description: '日本著名小说家，代表作有《挪威的森林》、《海边的卡夫卡》等',
      isEnabled: true,
      roleTypeIds: [roleTypeMap.WRITER],
      nationality: '日本',
      gender: AuthorGenderEnum.MALE,
      socialLinks: JSON.stringify({
        twitter: '@haruki_murakami',
        instagram: '@murakami_official',
      }),
      remark: '国际知名作家，作品深受读者喜爱',
      worksCount: 0,
      followersCount: 0,
      featured: true,
    },
    {
      name: '东野圭吾',
      avatar: 'https://example.com/avatars/keigo-higashino.jpg',
      description: '日本推理小说家，代表作有《白夜行》、《嫌疑人X的献身》等',
      isEnabled: true,
      roleTypeIds: [roleTypeMap.WRITER],
      nationality: '日本',
      gender: AuthorGenderEnum.MALE,
      socialLinks: JSON.stringify({
        website: 'https://higashino-keigo.com',
      }),
      remark: '推理小说大师，作品逻辑严密',
      worksCount: 0,
      followersCount: 0,
      featured: true,
    },
    {
      name: '尾田荣一郎',
      avatar: 'https://example.com/avatars/eiichiro-oda.jpg',
      description: '日本漫画家，《海贼王》作者',
      isEnabled: true,
      roleTypeIds: [roleTypeMap.MANGAKA],
      nationality: '日本',
      gender: AuthorGenderEnum.MALE,
      socialLinks: JSON.stringify({
        twitter: '@Eiichiro_Staff',
      }),
      remark: '世界知名漫画家，海贼王创作者',
      worksCount: 0,
      followersCount: 0,
      featured: true,
    },
    {
      name: '鸟山明',
      avatar: 'https://example.com/avatars/akira-toriyama.jpg',
      description: '日本漫画家，《龙珠》、《阿拉蕾》作者',
      isEnabled: true,
      roleTypeIds: [roleTypeMap.MANGAKA],
      nationality: '日本',
      gender: AuthorGenderEnum.MALE,
      socialLinks: JSON.stringify({}),
      remark: '传奇漫画家，影响了一代人',
      worksCount: 0,
      followersCount: 0,
      featured: true,
    },
  ]

  for (const { roleTypeIds, ...authorData } of initData) {
    await prisma.workAuthor.upsert({
      where: { name: authorData.name },
      update: {
        ...authorData,
        authorRoles: {
          deleteMany: {},
          create: roleTypeIds.map((roleTypeId, index) => ({
            roleTypeId,
            isPrimary: index === 0,
          })),
        },
      },
      create: {
        ...authorData,
        authorRoles: {
          create: roleTypeIds.map((roleTypeId, index) => ({
            roleTypeId,
            isPrimary: index === 0,
          })),
        },
      },
    })
  }
}
