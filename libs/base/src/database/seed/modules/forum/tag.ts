interface IForumTagData {
  name: string
  description: string
  order: number
  isEnabled: boolean
}

export async function createInitialForumTags(prisma: any) {
  const INITIAL_FORUM_TAGS: IForumTagData[] = [
    {
      name: 'JavaScript',
      description: 'JavaScript 相关讨论',
      order: 1,
      isEnabled: true,
    },
    {
      name: 'TypeScript',
      description: 'TypeScript 相关讨论',
      order: 2,
      isEnabled: true,
    },
    {
      name: 'Node.js',
      description: 'Node.js 相关讨论',
      order: 3,
      isEnabled: true,
    },
    {
      name: 'React',
      description: 'React 相关讨论',
      order: 4,
      isEnabled: true,
    },
    {
      name: 'Vue',
      description: 'Vue 相关讨论',
      order: 5,
      isEnabled: true,
    },
    {
      name: 'Angular',
      description: 'Angular 相关讨论',
      order: 6,
      isEnabled: true,
    },
    {
      name: 'Python',
      description: 'Python 相关讨论',
      order: 7,
      isEnabled: true,
    },
    {
      name: 'Java',
      description: 'Java 相关讨论',
      order: 8,
      isEnabled: true,
    },
    {
      name: 'Go',
      description: 'Go 相关讨论',
      order: 9,
      isEnabled: true,
    },
    {
      name: 'Rust',
      description: 'Rust 相关讨论',
      order: 10,
      isEnabled: true,
    },
  ]

  for (const tagData of INITIAL_FORUM_TAGS) {
    const existingTag = await prisma.forumTag.findFirst({
      where: { name: tagData.name },
    })

    if (!existingTag) {
      await prisma.forumTag.create({
        data: tagData,
      })
    }
  }
}
