# Drizzle 使用规范（面向 AI 生成代码）

适用范围：基于本项目的 NestJS + Drizzle ORM 服务层实现。该规范从 `libs/config/src/dictionary/dictionary.service.ts` 的实际用法抽取而来，用于约束 AI 生成代码的风格与行为。

## 强制规则（Must）
1. 读操作优先使用 `this.db.query.<table>.findFirst/findMany`，不要拼接原始 SQL。
2. 写操作（insert/update/delete）必须包裹在 `this.drizzle.withErrorHandling(() => ...)` 中，以统一处理数据库错误。
3. 写操作完成后必须调用 `this.drizzle.assertAffectedRows(result, '<资源不存在提示>')` 来保证数据存在性。
4. 表对象必须从 `this.drizzle.schema` 获取，不允许在服务内重新声明表结构。
5. 需要分页的列表查询必须使用 `this.drizzle.ext.findPagination`。
6. 动态条件使用 `SQL[]` 收集，并以 `and(...conditions)` 组合；当条件为空时 `where` 传 `undefined`。
7. 需要模糊查询时使用 `like(column, `%${value}%`)`；等值匹配使用 `eq(column, value)`。
8. 业务校验失败使用 `BadRequestException`，读取不到数据使用 `NotFoundException`。
9. 所有方法返回值与现有服务一致：成功场景返回 `true` 或实体数据，不返回 `void`。

## 推荐规则（Should）
1. 为 `db`、`dictionary`、`dictionaryItem` 这类对象提供 `private get` 访问器以保持一致性。
2. 可复用的查询条件构建封装为私有方法（如 `buildSearchConditions`）。
3. 多值参数（如 `dictionaryCode`）先 parse 为数组并做空值校验，再进入查询。
4. 启用状态筛选用 `isEnabled !== undefined` 判断是否追加条件。
5. 排序字段使用 `orderBy` 显式传入，避免隐式排序。

## 禁止行为（Don’t）
1. 不要直接使用字符串拼接构建 SQL。
2. 不要跳过 `withErrorHandling` 或 `assertAffectedRows`。
3. 不要在服务层绕过 `schema` 直接引用表名字符串。

## 参考模板（可直接复用）
```ts
// 读
async findById(id: number) {
  const data = await this.db.query.someTable.findFirst({ where: { id } })
  if (!data) {
    throw new NotFoundException('资源不存在')
  }
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

// 分页查询
async list(query: QueryDto) {
  const conditions: SQL[] = []
  if (query.name) conditions.push(like(this.someTable.name, `%${query.name}%`))
  return this.drizzle.ext.findPagination(this.someTable, {
    where: conditions.length > 0 ? and(...conditions) : undefined,
    ...query,
  })
}
```

## 约束来源
本规范基于 `libs/config/src/dictionary/dictionary.service.ts` 中对 Drizzle 的实际使用方式整理。


