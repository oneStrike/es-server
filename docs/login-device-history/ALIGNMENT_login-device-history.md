# 登录设备历史记录功能对齐文档

## 1. 项目上下文分析

### 1.1 现状分析
*   **当前存储**: 目前系统使用 `AppUserToken` 表存储用户的登录会话（JWT）。
*   **清理机制**: 系统存在定时任务 (`AuthCronService`)，会自动清理过期且未刷新的 Token。
*   **数据保留**: `AppUser` 表仅记录 `lastLoginAt` (最后登录时间) 和 `lastLoginIp` (最后登录IP)，不保留历史记录。
*   **问题**: 用户希望查看“历史登录设备”，但目前的 `AppUserToken` 数据是临时的，Token 过期或用户登出后，设备信息会随之丢失或被标记为撤销（随后被物理删除），无法满足长期查看历史设备的需求。

### 1.2 目标
*   实现一个持久化的“用户登录设备历史”记录功能。
*   确保数据不会因 Token 过期而被自动清除。
*   符合社区最佳实践。

## 2. 需求理解与方案建议

### 2.1 核心冲突
*   **Token (会话)** vs **Device (设备)**: Token 是短暂的认证凭证，Device 是长期的物理实体。不能将设备历史强绑定在 Token 表上。

### 2.2 推荐方案：引入 `AppUserDevice` 实体

建议新增一个独立的数据库模型 `AppUserDevice`，用于专门管理用户的受信任设备/历史设备。

#### 方案细节
1.  **新建表结构 (`AppUserDevice`)**:
    *   **唯一标识**: 结合 `userId` 和 `deviceUniqueId` (设备唯一标识) 进行去重。
    *   **设备信息**: `deviceName` (设备名称), `deviceType` (类型), `os`, `browser`。
    *   **状态信息**: `lastLoginAt` (最后活动时间), `lastLoginIp` (最后IP)。
    *   **管理字段**: `isTrusted` (是否信任), `status` (正常/禁用)。

2.  **业务逻辑变更**:
    *   **登录时**: 在生成 Token 之前/之后，异步更新 `AppUserDevice` 表。
        *   如果设备ID已存在，更新 `lastLoginAt` 和 `lastLoginIp`。
        *   如果不存在，创建新记录。
    *   **查询时**: 提供接口 `GET /auth/devices` 查询该用户的设备列表。
    *   **管理时**: 用户可以移除（软删除）某个设备，强制该设备下线（可选：同时撤销关联的 Token）。

### 2.3 关键技术决策点 (需要您确认)

#### Q1: 设备唯一标识 (Device ID) 的来源？
*   **选项 A (推荐 - 客户端生成)**: 客户端 (App/Web) 生成一个随机 UUID 并持久化在本地 (LocalStorage/Keychain)，登录时通过 Header (如 `X-Device-Id`) 传给后端。这是最准确的方式。
*   **选项 B (后端推断)**: 后端根据 `User-Agent` + `IP` 生成哈希。缺点是容易冲突（同一局域网下相同浏览器），或者不稳定（IP 变动视为新设备）。
*   **建议**: 采用 **选项 A**。如果客户端未传，降级为 **选项 B** 或生成随机ID返回给客户端保存。

#### Q2: 数据清理策略？
虽然用户说“不要自动清除”，但为了数据库健康，通常建议：
*   **策略 A**: 永久保留，直到用户手动删除。
*   **策略 B**: 保留最近 N 条（如 20 条），超出覆盖最旧的。
*   **策略 C**: 自动清理长期不活跃的设备（如超过 1 年未登录）。
*   **建议**: **策略 A** 或 **策略 C**。

#### Q3: 是否需要完整的登录流水日志？
*   **设备历史**: 关注“我去过哪些地方/用过哪些手机”。(去重，强调实体)
*   **登录日志**: 关注“我什么时候登录了一次”。(不去重，强调事件)
*   **理解**: 根据您的描述“记录历史登录设备”，应为 **设备历史**。

## 3. 拟定数据结构 (Prisma)

```prisma
model AppUserDevice {
  id             Int       @id @default(autoincrement())
  userId         Int       @map("user_id")
  
  // 核心识别字段
  deviceUniqueId String    @map("device_unique_id") @db.VarChar(100) // 客户端生成的UUID
  
  // 展示字段
  deviceName     String?   @map("device_name") @db.VarChar(100)      // 如 "iPhone 13" 或 "Chrome on Windows"
  deviceType     String?   @map("device_type") @db.VarChar(50)       // mobile, desktop, tablet
  os             String?   @map("os") @db.VarChar(50)
  browser        String?   @map("browser") @db.VarChar(50)
  
  // 状态字段
  lastLoginIp    String?   @map("last_login_ip") @db.VarChar(45)
  lastLoginAt    DateTime  @default(now()) @map("last_login_at") @db.Timestamptz
  
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  user           AppUser   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, deviceUniqueId]) // 确保同一用户下的设备ID唯一
  @@map("app_user_device")
}
```

## 4. 下一步计划
1.  确认上述方案和决策点。
2.  进入 Architect 阶段，设计详细接口和数据流。
