import { Prisma } from '../index'

export async function exists<T>(
  this: T,
  where: Prisma.Args<T, 'findFirst'>['where'],
): Promise<boolean> {
  const context = Prisma.getExtensionContext(this)

  const result = await (context as any).findFirst({
    where,
    select: { id: true },
  })
  return result !== null
}
