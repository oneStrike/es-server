import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { IdDto, IdsDto } from '@libs/platform/dto/base.dto';
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import {
  CreateAppPageDto,
  QueryAppPageDto,
  QueryPageByCodeDto,
  UpdateAppPageDto,
} from './dto/page.dto'

/**
 * 应用页面服务
 *
 * 负责页面配置写入、分页检索和启停管理
 */
@Injectable()
export class AppPageService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 页面表 */
  private get appPage() {
    return this.drizzle.schema.appPage
  }

  /**
   * 创建页面配置。
   * 页面 `code` 和 `path` 命中唯一约束时统一转成业务异常，避免泄露底层数据库错误。
   */
  async createPage(createPageDto: CreateAppPageDto) {
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.appPage).values(createPageDto),
      { duplicate: '页面编码或路径已存在' },
    )
    return true
  }

  /**
   * 根据名称、编码、权限和平台等条件查询页面分页。
   * `enablePlatform` 保持 JSON 字符串输入，兼容 query 参数的序列化方式。
   */
  async findPage(queryPageDto: QueryAppPageDto) {
    const { name, code, accessLevel, isEnabled, enablePlatform, ...other } =
      queryPageDto

    const conditions: SQL[] = []

    // 名称模糊查询
    if (name) {
      conditions.push(buildILikeCondition(this.appPage.name, name)!)
    }

    // 编码等值查询
    if (code) {
      conditions.push(eq(this.appPage.code, code))
    }

    // 访问级别
    if (accessLevel !== undefined) {
      conditions.push(eq(this.appPage.accessLevel, accessLevel))
    }

    // 启用状态
    if (isEnabled !== undefined) {
      conditions.push(eq(this.appPage.isEnabled, isEnabled))
    }

    // 平台筛选
    if (enablePlatform && enablePlatform !== '[]') {
      const platforms = JSON.parse(enablePlatform).map((item: string) =>
        Number(item),
      )
      if (platforms.length > 0) {
        conditions.push(inArray(this.appPage.enablePlatform, platforms))
      }
    }

    return this.drizzle.ext.findPagination(this.appPage, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...other,
    })
  }

  /**
   * 查询所有已启用页面，供 app/public 侧一次性拉取静态页面配置。
   */
  async findActivePages() {
    return this.db.query.appPage.findMany({
      where: { isEnabled: true },
    })
  }

  /**
   * 按主键查询页面详情，未命中时抛出 `NotFoundException`。
   */
  async findById(dto: IdDto) {
    const page = await this.db.query.appPage.findFirst({
      where: { id: dto.id },
    })

    if (!page) {
      throw new NotFoundException('页面不存在')
    }
    return page
  }

  /**
   * 按页面编码查询详情，适用于需要通过业务编码定位页面的后台入口。
   */
  async findByCode(dto: QueryPageByCodeDto) {
    const page = await this.db.query.appPage.findFirst({
      where: { code: dto.code },
    })

    if (!page) {
      throw new NotFoundException('页面不存在')
    }
    return page
  }

  /**
   * 更新页面配置主体字段。
   * 主键不存在或命中唯一约束时，分别转换为明确的业务异常。
   */
  async updatePage(updatePageDto: UpdateAppPageDto) {
    const { id, ...updateData } = updatePageDto

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appPage)
          .set(updateData)
          .where(eq(this.appPage.id, id)),
      { duplicate: '页面编码或路径已存在' },
    )

    this.drizzle.assertAffectedRows(result, '页面不存在')
    return true
  }

  /**
   * 批量下线页面。
   * 该操作只更新启用状态，保留页面记录用于后续审计和恢复。
   */
  async batchDelete(dto: IdsDto) {
    const { ids } = dto
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appPage)
        .set({ isEnabled: false })
        .where(inArray(this.appPage.id, ids)),
    )

    this.drizzle.assertAffectedRows(result, '页面不存在')
    return true
  }
}
