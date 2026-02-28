# Prisma Seed

独立的 Prisma Seed 脚本，可脱离主项目运行。

## 环境要求

- Node.js >= 18.0.0
- PostgreSQL 数据库

## 快速开始

### 方式一：使用主项目的依赖（推荐）

在项目根目录执行：

```bash
# 使用项目配置的数据库连接
pnpm prisma:seed

# 或者使用自定义数据库连接
DATABASE_URL="postgresql://user:password@localhost:5432/dbname" pnpm prisma:seed
```

### 方式二：独立运行

在 `prisma/seed` 目录下执行：

```bash
# 1. 安装依赖
pnpm install

# 2. 设置数据库连接（可选，默认使用本地开发数据库）
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# 3. 运行 seed
pnpm seed
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://postgres:259158@localhost:5432/foo` |
| `NODE_ENV` | 环境模式 | `development` |

## 文件结构

```
prisma/seed/
├── index.ts              # 主入口
├── prisma-client.ts      # PrismaClient 封装
├── package.json          # 独立运行依赖
├── tsconfig.json         # TypeScript 配置
├── README.md             # 说明文档
└── modules/              # Seed 模块
    ├── admin/            # 管理员账号
    ├── app/              # 应用配置
    ├── forum/            # 论坛数据
    ├── interaction/      # 交互数据
    ├── system/           # 系统数据
    └── work/             # 作品数据
```

## 注意事项

1. **生产环境**：必须设置 `DATABASE_URL` 环境变量，不允许使用默认值
2. **数据库要求**：确保数据库已迁移，表结构已创建
3. **幂等性**：所有 seed 操作都是幂等的，可以重复执行
