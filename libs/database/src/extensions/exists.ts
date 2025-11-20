import { Prisma } from '../prisma-client/client'

export async function exists<T>(
  this: T,
  where: Prisma.Args<T, 'findFirst'>['where'],
): Promise<boolean> {
  const context = Prisma.getExtensionContext(this)

  const result = await (context as any).findFirst({ where })
  return result !== null
}
