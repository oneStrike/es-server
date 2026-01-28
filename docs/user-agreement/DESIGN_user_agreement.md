# 用户协议功能设计文档 (DESIGN)

## 1. 数据库设计 (Schema)

基于 Prisma 的数据模型设计。

### 1.1 协议表 (`AppAgreement`)
用于存储协议的内容和版本信息。

```prisma
/// 应用协议表 - 存储隐私政策、用户协议等
model AppAgreement {
  /// 主键ID
  id Int @id @default(autoincrement())

  /// 协议类型（唯一标识，如 privacy, service, payment）
  type String @map("type") @db.VarChar(50)

  /// 协议标题
  title String @map("title") @db.VarChar(200)

  /// 协议内容 (HTML/Markdown)
  content String @map("content") @db.Text

  /// 版本号 (如 1.0.0, 20231027)
  version String @map("version") @db.VarChar(50)

  /// 是否强制重新同意 (用于重大更新)
  isForce Boolean @default(false) @map("is_force")

  /// 是否已发布
  isPublished Boolean @default(false) @map("is_published")

  /// 发布时间
  publishedAt DateTime? @map("published_at") @db.Timestamptz(6)

  /// 创建时间
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  /// 更新时间
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  /// 签署记录关联
  agreementLogs AppAgreementLog[]

  /// 联合唯一索引：同一类型的协议可能有多个版本，但同一类型的同一版本应该是唯一的
  @@unique([type, version])
  @@index([type, isPublished])
  @@map("app_agreement")
}
```

### 1.2 协议签署记录表 (`AppAgreementLog`)
用于记录用户的签署行为（审计用）。

```prisma
/// 应用协议签署记录表
model AppAgreementLog {
  /// 主键ID
  id BigInt @id @default(autoincrement())

  /// 用户ID
  userId Int @map("user_id")

  /// 协议ID
  agreementId Int @map("agreement_id")

  /// 签署时的协议版本快照
  version String @map("version") @db.VarChar(50)

  /// 签署时间
  agreedAt DateTime @default(now()) @map("agreed_at") @db.Timestamptz(6)

  /// 签署IP
  ipAddress String? @map("ip_address") @db.VarChar(45)

  /// 设备信息/UserAgent
  deviceInfo String? @map("device_info") @db.VarChar(500)

  /// 关联协议
  agreement AppAgreement @relation(fields: [agreementId], references: [id])

  /// 关联用户 (假设 AppUser 存在)
  user AppUser @relation(fields: [userId], references: [id])

  /// 索引
  @@index([userId, agreementId])
  @@index([agreedAt])
  @@map("app_agreement_log")
}
```

## 2. 模块设计

### 2.1 Libs 层 (`libs/app-config`)
- **Location**: `libs/app-config/src/agreement`
- **Components**:
  - `AgreementService`: 处理 CRUD 和签署逻辑。
  - `AgreementRepository`: 封装 Prisma 操作。

### 2.2 API 层

#### Admin API (`apps/admin-api`)
- **Controller**: `AgreementController`
- **Endpoints**:
  - `POST /agreements`: 创建新协议草稿。
  - `PUT /agreements/:id`: 更新协议内容。
  - `POST /agreements/:id/publish`: 发布协议。
  - `GET /agreements`: 列表查询（含历史版本）。
  - `GET /agreements/:id`: 详情。

#### App API (`apps/app-api`)
- **Controller**: `AgreementController`
- **Endpoints**:
  - `GET /agreements/latest`: 获取指定类型(`type`)的最新已发布协议。
  - `POST /agreements/accept`: 用户签署协议（记录日志）。
  - `GET /agreements/status`: 检查用户对各协议的签署状态（用于判断是否弹窗）。

## 3. 待确认事项

1. **版本控制策略**: 是每次修改都生成新记录（Immutability），还是允许修改草稿？
   - **建议**: 允许修改 `isPublished=false` 的草稿。一旦发布，必须创建新版本。
2. **签署记录**: 是否需要记录 `AppUser` 关联？
   - **建议**: 是，强关联 `AppUser` 以便查询。
