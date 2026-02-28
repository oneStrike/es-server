# 系统公告改造 - 待办事项

## 一、数据库迁移（必须）

### 1.1 执行迁移命令

当数据库服务可用时，执行以下命令：

```bash
# 方式一：直接执行迁移（会清空现有数据）
npx prisma migrate dev --name rename_notice_to_announcement

# 方式二：如果迁移文件已创建，可直接部署
npx prisma migrate deploy
```

### 1.2 填充种子数据

迁移完成后，执行种子数据填充：

```bash
npx prisma db seed
```

## 二、前端配合（必须）

### 2.1 API 路径变更

需要前端更新以下接口路径：

**Admin API：**
- `/admin/notice/*` → `/admin/announcement/*`

**App API：**
- `/app/system/notice` → `/app/system/announcement`

### 2.2 数据结构变更

**新增字段：**
- `summary`: 公告摘要（可选）
- `viewCount`: 浏览次数

**重命名字段：**
- `noticeType` → `announcementType`

**枚举值变更：**
- 类型枚举新增 `POLICY = 4`（政策公告）

## 三、配置检查

### 3.1 环境变量

确保 `.env` 文件中数据库连接配置正确：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/database"
```

### 3.2 Prisma 配置

检查 `prisma.config.ts` 配置是否正确。

## 四、测试验证

### 4.1 功能测试

- [ ] Admin API 创建公告
- [ ] Admin API 分页查询公告
- [ ] Admin API 更新公告
- [ ] Admin API 删除公告
- [ ] App API 获取公告列表

### 4.2 数据验证

- [ ] 种子数据正确填充
- [ ] 公告类型枚举正确
- [ ] 新增字段正常工作

## 五、注意事项

1. **数据丢失警告**：此次迁移会清空现有公告数据
2. **前端同步**：前端需要同步更新 API 路径
3. **环境检查**：确保数据库服务正常运行后再执行迁移

## 六、快速命令参考

```bash
# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate dev

# 填充种子数据
npx prisma db seed

# 检查数据库状态
npx prisma db push --help

# 打开 Prisma Studio
npx prisma studio
```
