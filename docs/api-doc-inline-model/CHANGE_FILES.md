# ApiDoc 内联 Model 重构改动清单

## 扫描结果（内联 Model 位置）

说明：基础类型（如 number/boolean/string）允许保留内联定义，不纳入重构范围。

1. d:\code\es\es-server\apps\admin-api\src\modules\user-growth\overview\overview.controller.ts
   - 行号：12-103
   - 现状：`model: { type: 'object', properties: ... }`
2. d:\code\es\es-server\apps\app-api\src\modules\user\user.controller.ts
   - 行号：23-115
   - 现状：`model: { type: 'object', properties: ... }`

## 改动文件清单（路径 + 修改类型 + 优先级）

1. d:\code\es\es-server\apps\admin-api\src\modules\user-growth\overview\overview.controller.ts | 引用新 DTO，替换内联 model | 高
2. d:\code\es\es-server\apps\app-api\src\modules\user\user.controller.ts | 引用新 DTO，替换内联 model | 高
3. d:\code\es\es-server\libs\user\src\growth-overview\dto\growth-overview.dto.ts | 新增 DTO | 高
4. d:\code\es\es-server\libs\user\src\growth-overview\index.ts | 新增导出 | 中
5. d:\code\es\es-server\libs\user\src\index.ts | 新增导出 | 中

## 重构后完整代码版本

### apps\admin-api\src\modules\user-growth\overview\overview.controller.ts

```ts
import { ApiDoc } from '@libs/base/decorators'
import { UserGrowthOverviewDto } from '@libs/user/growth-overview'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { UserGrowthOverviewService } from './overview.service'

@Controller('/admin/user-growth/overview')
@ApiTags('用户成长/概览')
export class UserGrowthOverviewController {
  constructor(private readonly overviewService: UserGrowthOverviewService) {}

  @Get()
  @ApiDoc({
    summary: '获取用户成长概览',
    model: UserGrowthOverviewDto,
  })
  async getOverview(@Query('userId') userId: number) {
    return this.overviewService.getOverview(userId)
  }
}
```

### apps\app-api\src\modules\user\user.controller.ts

```ts
import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, CurrentUser } from '@libs/base/decorators'
import { UserGrowthOverviewDto } from '@libs/user/growth-overview'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { BaseAppUserDto } from '../auth/dto/auth.dto'
import { UserService } from './user.service'

@ApiTags('用户模块')
@Controller('app/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiDoc({
    summary: '获取用户信息',
    model: BaseAppUserDto,
  })
  async getProfile(@CurrentUser() user: JwtUserInfoInterface) {
    return this.userService.getUserProfile(user.sub)
  }

  @Get('growth/overview')
  @ApiDoc({
    summary: '获取成长概览',
    model: UserGrowthOverviewDto,
  })
  async getGrowthOverview(@CurrentUser() user: JwtUserInfoInterface) {
    return this.userService.getUserGrowthOverview(user.sub)
  }
}
```


### libs\user\src\growth-overview\dto\growth-overview.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger'
import { UserLevelInfoDto } from '../../level-rule/dto/level-rule.dto'

export class UserGrowthOverviewBadgeInfoDto {
  @ApiProperty({
    description: '徽章ID',
    example: 1,
  })
  id!: number

  @ApiProperty({
    description: '徽章名称',
    example: '活跃用户',
  })
  name!: string

  @ApiProperty({
    description: '徽章描述',
    example: '连续登录7天',
    required: false,
    nullable: true,
  })
  description?: string

  @ApiProperty({
    description: '徽章图标URL',
    example: 'https://example.com/badge.png',
    required: false,
    nullable: true,
  })
  icon?: string

  @ApiProperty({
    description: '徽章类型',
    example: 1,
  })
  type!: number

  @ApiProperty({
    description: '排序值',
    example: 0,
  })
  sortOrder!: number

  @ApiProperty({
    description: '是否启用',
    example: true,
  })
  isEnabled!: boolean
}

export class UserGrowthOverviewBadgeDto {
  @ApiProperty({
    description: '用户ID',
    example: 1,
  })
  userId!: number

  @ApiProperty({
    description: '徽章ID',
    example: 1,
  })
  badgeId!: number

  @ApiProperty({
    description: '获得时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date

  @ApiProperty({
    description: '徽章信息',
    type: UserGrowthOverviewBadgeInfoDto,
  })
  badge!: UserGrowthOverviewBadgeInfoDto
}

export class UserGrowthOverviewDto {
  @ApiProperty({
    description: '积分',
    example: 100,
  })
  points!: number

  @ApiProperty({
    description: '经验',
    example: 1000,
  })
  experience!: number

  @ApiProperty({
    description: '等级ID',
    example: 1,
    required: false,
    nullable: true,
  })
  levelId?: number

  @ApiProperty({
    description: '等级信息',
    type: UserLevelInfoDto,
    required: false,
    nullable: true,
  })
  levelInfo?: UserLevelInfoDto

  @ApiProperty({
    description: '徽章列表',
    type: [UserGrowthOverviewBadgeDto],
  })
  badges!: UserGrowthOverviewBadgeDto[]
}
```

### libs\user\src\growth-overview\index.ts

```ts
export * from './dto/growth-overview.dto'
```

### libs\user\src\index.ts

```ts
export * from './badge'
export * from './experience'
export * from './growth-event'
export * from './growth-overview'
export * from './level-rule'
export * from './point'
```

