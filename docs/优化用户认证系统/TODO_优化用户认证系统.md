# 优化用户认证系统 - 待办事项

## 待办事项

### 功能增强
1. **登录日志记录**
   - 记录用户登录时间、IP地址、设备信息
   - 记录登录失败次数
   - 提供登录历史查询接口

2. **账号锁定功能**
   - 多次登录失败后锁定账号
   - 管理员可以解锁账号
   - 提供账号锁定状态查询

3. **双因素认证（2FA）**
   - 支持短信验证码二次验证
   - 支持TOTP（如Google Authenticator）
   - 提供绑定和解除绑定功能

4. **第三方登录**
   - 微信登录
   - QQ登录
   - 支付宝登录
   - 绑定第三方账号功能

### 安全增强
1. **密码强度检测**
   - 实时检测密码强度
   - 提供密码强度提示
   - 禁止使用弱密码

2. **密码过期策略**
   - 设置密码有效期
   - 提示用户修改密码
   - 强制修改过期密码

3. **会话管理**
   - 查看所有活跃会话
   - 撤销指定会话
   - 撤销所有会话

4. **IP白名单/黑名单**
   - 支持IP白名单
   - 支持IP黑名单
   - 异常IP登录提醒

### 用户体验优化
1. **记住我功能**
   - 延长Refresh Token有效期
   - 自动登录功能

2. **密码找回流程优化**
   - 发送重置密码链接
   - 验证身份信息
   - 安全重置密码

3. **手机号绑定**
   - 绑定新手机号
   - 验证旧手机号
   - 更新手机号

4. **邮箱绑定**
   - 绑定邮箱
   - 邮箱验证
   - 更新邮箱

### 监控和统计
1. **登录统计**
   - 每日/每周/每月登录用户数
   - 登录方式统计
   - 登录失败统计

2. **用户活跃度分析**
   - 活跃用户统计
   - 流失用户分析
   - 用户留存率分析

3. **安全事件监控**
   - 异常登录检测
   - 暴力破解检测
   - 账号异常行为检测

## 缺少的配置

### 环境变量配置
1. **验证码配置**
   - 验证码有效期（当前：5分钟）
   - 验证码长度（当前：6位）
   - 验证码发送频率限制

2. **Token配置**
   - Access Token有效期（当前：15分钟）
   - Refresh Token有效期（当前：7天）
   - Token刷新策略

3. **密码策略配置**
   - 密码最小长度
   - 密码复杂度要求
   - 密码有效期
   - 密码历史记录数量

4. **登录限制配置**
   - 登录失败次数限制
   - 账号锁定时间
   - IP访问频率限制

### 数据库配置
1. **Token存储**
   - Token表索引优化
   - Token清理策略
   - Token历史记录保留时间

2. **用户表优化**
   - 添加用户状态字段
   - 添加用户等级字段
   - 添加用户标签字段

### 日志配置
1. **登录日志**
   - 登录日志表设计
   - 日志保留策略
   - 日志查询优化

2. **操作日志**
   - 操作日志表设计
   - 日志级别配置
   - 日志存储策略

## 操作指引

### 添加登录日志记录功能

1. 创建登录日志表
```prisma
model AppUserLoginLog {
  id          Int      @id @default(autoincrement())
  userId      Int
  loginTime   DateTime @default(now())
  loginIp     String
  deviceInfo  String?
  userAgent   String?
  loginStatus Boolean
  failureReason String?
  user        AppUser  @relation(fields: [userId], references: [id])
  @@index([userId])
  @@index([loginTime])
}
```

2. 在AuthService中添加记录登录日志的方法
```typescript
private async recordLoginLog(userId: number, req: FastifyRequest, status: boolean, failureReason?: string) {
  await this.prisma.appUserLoginLog.create({
    data: {
      userId,
      loginIp: extractIpAddress(req) || ErrorMessages.IP_ADDRESS_UNKNOWN,
      deviceInfo: JSON.stringify(parseDeviceInfo(req.headers['user-agent'])),
      userAgent: req.headers['user-agent'],
      loginStatus: status,
      failureReason,
    },
  })
}
```

3. 在login方法中调用记录登录日志

### 添加账号锁定功能

1. 在AppUser表中添加锁定相关字段
```prisma
model AppUser {
  // ... 其他字段
  isLocked        Boolean  @default(false)
  lockedUntil     DateTime?
  failedLoginCount Int      @default(0)
  lastFailedLoginTime DateTime?
}
```

2. 在AuthService中添加检查账号锁定状态的方法
```typescript
private checkAccountLockStatus(user: AppUser) {
  if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
    throw new BadRequestException('账号已被锁定，请稍后再试')
  }
}
```

3. 在login方法中添加登录失败计数和锁定逻辑

### 添加密码强度检测

1. 创建密码强度检测工具
```typescript
export class PasswordStrengthChecker {
  static check(password: string): { strength: number; message: string } {
    // 实现密码强度检测逻辑
  }
}
```

2. 在注册和修改密码时调用密码强度检测

3. 在前端显示密码强度提示

## 注意事项

1. **安全性**
   - 所有敏感信息必须加密存储
   - 避免在日志中记录敏感信息
   - 定期更新安全策略

2. **性能**
   - Token查询需要添加索引
   - 登录日志需要定期清理
   - 避免频繁的数据库查询

3. **可维护性**
   - 保持代码简洁易读
   - 添加适当的注释
   - 遵循项目代码规范

4. **可扩展性**
   - 预留扩展接口
   - 使用策略模式处理不同登录方式
   - 支持插件化功能
