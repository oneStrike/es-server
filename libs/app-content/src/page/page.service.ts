import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'
import { IdsDto } from '@libs/platform/dto'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, ilike, inArray } from 'drizzle-orm'
import {
  AppPageQueryInput,
  CreateAppPageInput,
  UpdateAppPageInput,
} from './page.type'

/**
 * 应用页面服务
 *
 * 负责页面配置的创建、查询与更新
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
   * 创建页面
   *
   * @param createPageDto 创建页面的数据传输对象
   * @returns 是否成功
   * @throws BadRequestException 当页面编码或路径已存在时
   */
  async createPage(createPageDto: CreateAppPageInput) {
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.appPage).values(createPageDto),
      { duplicate: '页面编码或路径已存在' },
    )
    return true
  }

  /**
   * 分页查询页面列表
   *
   * @param queryPageDto 查询条件
   * @returns 分页结果
   */
  async findPage(queryPageDto: AppPageQueryInput) {
    const { name, code, accessLevel, isEnabled, enablePlatform, ...other } =
      queryPageDto

    const conditions: SQL[] = []

    // 名称模糊查询
    if (name) {
      conditions.push(ilike(this.appPage.name, `%${name}%`))
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
   * 查询所有启用的页面
   *
   * @returns 启用状态的页面列表
   */
  async findActivePages() {
    return this.db.query.appPage.findMany({
      where: { isEnabled: true },
    })
  }

  /**
   * 根据ID查询页面详情
   *
   * @param id 页面ID
   * @returns 页面详情
   * @throws NotFoundException 当页面不存在时
   */
  async findById(id: number) {
    const page = await this.db.query.appPage.findFirst({
      where: { id },
    })

    if (!page) {
      throw new NotFoundException('页面不存在')
    }
    return page
  }

  /**
   * 根据编码查询页面详情
   *
   * @param code 页面编码
   * @returns 页面详情
   * @throws NotFoundException 当页面不存在时
   */
  async findByCode(code: string) {
    const page = await this.db.query.appPage.findFirst({
      where: { code },
    })

    if (!page) {
      throw new NotFoundException('页面不存在')
    }
    return page
  }

  /**
   * 更新页面
   *
   * @param updatePageDto 更新页面的数据传输对象
   * @returns 是否成功
   * @throws BadRequestException 当页面不存在或编码/路径冲突时
   */
  async updatePage(updatePageDto: UpdateAppPageInput) {
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
   * 批量删除页面
   *
   * @param dto 删除数据
   * @returns 是否成功
   */
  async batchDelete(dto: IdsDto) {
    const { ids } = dto
    const result = await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.appPage).where(inArray(this.appPage.id, ids)),
    )

    this.drizzle.assertAffectedRows(result, '页面不存在')
    return true
  }
}
