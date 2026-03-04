interface IWorkTagData {
  name: string
  icon?: string
  sortOrder?: number
}

export async function createInitialWorkTag(prisma: any) {
  const INITIAL_WORK_TAGS: IWorkTagData[] = [
    { name: '热血', icon: '🔥', sortOrder: 1 },
    { name: '冒险', icon: '⚔️', sortOrder: 2 },
    { name: '科幻', icon: '🚀', sortOrder: 3 },
    { name: '悬疑', icon: '🔍', sortOrder: 4 },
    { name: '爱情', icon: '❤️', sortOrder: 5 },
    { name: '喜剧', icon: '😂', sortOrder: 6 },
    { name: '悲剧', icon: '😢', sortOrder: 7 },
    { name: '恐怖', icon: '👻', sortOrder: 8 },
    { name: '奇幻', icon: '🧙‍♂️', sortOrder: 9 },
    { name: '校园', icon: '🏫', sortOrder: 10 },
    { name: '职场', icon: '💼', sortOrder: 11 },
    { name: '历史', icon: '📜', sortOrder: 12 },
    { name: '战争', icon: '💣', sortOrder: 13 },
    { name: '体育', icon: '⚽', sortOrder: 14 },
    { name: '音乐', icon: '🎵', sortOrder: 15 },
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
          sortOrder: tagData.sortOrder,
          isEnabled: true,
          popularity: 0,
        },
      })
    }
  }
}
