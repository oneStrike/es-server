# 登录设备历史记录功能对齐文档 (V4 - 最佳实践版)

## 1. 社区最佳实践设计理念

在设计用户设备管理和审计系统时，工业界的最佳实践通常遵循以下原则：

1.  **单一数据源 (Single Source of Truth)**：设备信息只应存储在“设备表”中，Token 表只存储引用（外键）。
2.  **审计不可变性 (Audit Immutability)**：登录日志必须是只增不减的流水账，用于事后追溯。
3.  **设备全生命周期管理**：设备不仅仅是一个“名称”，它有状态（活跃/禁用）、信任级别（受信任/临时）和最后活动时间。
4.  **性能与扩展性**：
    - 日志表数据量巨大，需要精简字段并建立合适索引。
    - 设备表读取频率高（每次刷新 Token 都要校验），需要轻量高效。

## 2. 推荐表结构设计 (V4)

### 2.1 用户设备表 (`AppUserDevice`)

**定位**：用户的“资产清单”。管理该用户所有受信任或已知的物理入口。

```prisma
model AppUserDevice {
  id             Int       @id @default(autoincrement())
  userId         Int       @map("user_id")

  // === 核心标识 ===
  // 最佳实践：客户端生成的唯一指纹，不随 Token 变化。
  deviceId String    @map("device_id") @db.VarChar(100)

  // === 描述信息 (元数据) ===
  // 最佳实践：打散存储便于统计分析 (如 "80% 用户使用 Chrome")，但也保留扩展能力
  deviceName     String?   @map("device_name") @db.VarChar(100) // 用户可自定义名称，如 "My iPhone"
  deviceType     String?   @map("device_type") @db.VarChar(50)  // mobile, desktop, browser
  os             String?   @map("os") @db.VarChar(50)           // iOS 15.0

  // === 安全与状态管控 (新增最佳实践字段) ===
  // 最佳实践：允许用户标记“信任此设备”（免二次验证）或“禁用此设备”（丢失后踢出）
  isTrusted      Boolean   @default(false) @map("is_trusted")
  status         String    @default("ACTIVE") @map("status") @db.VarChar(20) // ACTIVE, BLOCKED

  // === 活跃度追踪 ===
  // 最佳实践：不仅记录“登录”，也记录“刷新Token”的时间，反映真实活跃度
  lastLoginIp    String?   @map("last_login_ip") @db.VarChar(45)
  lastActiveAt   DateTime  @default(now()) @map("last_active_at") @db.Timestamptz

  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  user           AppUser        @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokens         AppUserToken[]
  loginLogs      AppUserLoginLog[]

  @@unique([userId, deviceUniqueId]) // 复合唯一键
  @@index([lastActiveAt])            // 便于清理长期不活跃设备（如果需要）
  @@map("app_user_device")
}
```

### 2.2 用户登录日志表 (`AppUserLoginLog`)

**定位**：安全审计流水。记录“谁、在什么时候、通过什么设备、做了什么”。

```prisma
model AppUserLoginLog {
  id             Int       @id @default(autoincrement())
  userId         Int       @map("user_id")

  // === 关联上下文 ===
  // 最佳实践：关联设备ID，但设置为可选（SET NULL），保证即使设备被删，日志依然存在（审计要求）
  deviceId       Int?      @map("device_id")

  // === 登录快照 ===
  // 最佳实践：记录原始环境快照，防止设备表更新后丢失当时的上下文
  ipAddress      String?   @map("ip_address") @db.VarChar(45)
  location       String?   @map("location") @db.VarChar(100)
  userAgent      String?   @map("user_agent") @db.VarChar(500)

  // === 行为详情 (新增最佳实践字段) ===
  // 最佳实践：明确登录方式（密码、验证码、三方登录），便于风控分析
  loginType      String    @default("PASSWORD") @map("login_type") @db.VarChar(20)
  status         String    @default("SUCCESS") @map("status") @db.VarChar(20) // SUCCESS, FAILED
  failReason     String?   @map("fail_reason") @db.VarChar(200)               // 若失败记录原因

  loginAt        DateTime  @default(now()) @map("login_at") @db.Timestamptz

  user           AppUser        @relation(fields: [userId], references: [id], onDelete: Cascade)
  device         AppUserDevice? @relation(fields: [deviceId], references: [id], onDelete: SetNull)

  @@index([userId, loginAt]) // 最常用的查询模式：用户的时间轴
  @@map("app_user_login_log")
}
```

### 2.3 应用用户令牌表 (`AppUserToken`)

**定位**：临时的会话凭证。

```prisma
model AppUserToken {
  id           Int       @id @default(autoincrement())
  jti          String    @unique @map("jti") @db.VarChar(255)
  userId       Int       @map("user_id")

  // === 关联设备 ===
  // 最佳实践：Token 必须属于某个设备。如果设备被禁用(status=BLOCKED)，该设备下的所有 Token 应立即失效。
  deviceId     Int?      @map("device_id")

  // === 核心 JWT 属性 ===
  tokenType    String    @map("token_type") @db.VarChar(20)
  expiresAt    DateTime  @map("expires_at") @db.Timestamptz
  revokedAt    DateTime? @map("revoked_at") @db.Timestamptz
  revokeReason String?   @map("revoke_reason") @db.VarChar(50)

  // === 安全校验 ===
  // 最佳实践：保留 IP 用于检测“会话劫持”（Session Hijacking）。
  // 如果当前请求 IP 与 Token 创建时 IP 跨度过大，可触发风控。
  ipAddress    String?   @map("ip_address") @db.VarChar(45)

  // 移除：deviceInfo, userAgent (已迁移至 Device 表)

  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  user         AppUser        @relation(fields: [userId], references: [id], onDelete: Cascade)
  device       AppUserDevice? @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([jti])
  @@index([expiresAt])
  @@map("app_user_token")
}
```

## 3. 设计理由总结

1.  **安全性增强**：
    - `AppUserDevice.status`: 增加了禁用设备的能力。如果手机丢失，用户可以在网页端禁用该设备，后端中间件检查到 `device.status == BLOCKED` 时拒绝服务。
    - `AppUserLoginLog.status`: 为记录登录失败（暴力破解）预留了位置。

2.  **数据一致性**：
    - `deviceInfo` 不再重复存储在 Token 中，避免了更新设备信息时需要同时更新多个 Token 的问题。

3.  **审计完整性**：
    - `AppUserLoginLog` 即使在设备被物理删除后，通过 `device_id` 置空策略，依然保留当时的 IP 和 UA 快照，确保历史可追溯。

## 4. 待确认事项

请确认这套基于**全生命周期管理**和**审计不可变性**的设计是否符合您的预期？
一旦确认，我将按照此结构生成 `CONSENSUS` 文档并开始 `Architect` 阶段。
