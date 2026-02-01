interface IWorkTagData {
  name: string
  icon?: string
  order?: number
}

export async function createInitialWorkTag(prisma: any) {
  const INITIAL_WORK_TAGS: IWorkTagData[] = [
    { name: '热血', icon: '🔥', order: 1 },
    { name: '冒险', icon: '⚔️', order: 2 },
    { name: '科幻', icon: '🚀', order: 3 },
    { name: '悬疑', icon: '🔍', order: 4 },
    { name: '爱情', icon: '❤️', order: 5 },
    { name: '喜剧', icon: '😂', order: 6 },
    { name: '悲剧', icon: '😢', order: 7 },
    { name: '恐怖', icon: '👻', order: 8 },
    { name: '奇幻', icon: '🧙‍♂️', order: 9 },
    { name: '校园', icon: '🏫', order: 10 },
    { name: '职场', icon: '💼', order: 11 },
    { name: '历史', icon: '📜', order: 12 },
    { name: '战争', icon: '💣', order: 13 },
    { name: '体育', icon: '⚽', order: 14 },
    { name: '音乐', icon: '🎵', order: 15 },
  ]

  for (const tagData of INITIAL_WORK_TAGS) {
    const existingTag = await prisma.workTag.findFirst({
      where: { name: tagData.name },
    })

    if (!existingTag) {
      await prisma.workTag.create({
        data: {
          name: tagData.name,
          icon: tagData.icon,
          order: tagData.order,
          isEnabled: true,
          popularity: 0,
        },
      })
    }
  }
}
