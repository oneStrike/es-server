# Drizzle 使用参考

本文件提供 Drizzle 常用写法参考，不是规范来源；硬约束以 `../rules/drizzle-guidelines.md` 为准。

## 常见模式

```ts
// 读
async findById(id: number) {
  const data = await this.db.query.someTable.findFirst({
    where: eq(this.someTable.id, id),
  })
  if (!data) throw new NotFoundException('资源不存在')
  return data
}

// 写（更新）
async update(dto: UpdateDto) {
  const { id, ...data } = dto
  const result = await this.drizzle.withErrorHandling(() =>
    this.db.update(this.someTable).set(data).where(eq(this.someTable.id, id)),
  )
  this.drizzle.assertAffectedRows(result, '资源不存在')
  return true
}

// 常规分页
async list(query: QueryDto) {
  return this.drizzle.ext.findPagination(this.someTable, {
    where: query.name ? ilike(this.someTable.name, `%${query.name}%`) : undefined,
    ...query,
  })
}

// 事务 + returning
async create(input: CreateInput) {
  return this.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(this.someTable)
      .values(input)
      .returning({ id: this.someTable.id })
    return row
  })
}
```
