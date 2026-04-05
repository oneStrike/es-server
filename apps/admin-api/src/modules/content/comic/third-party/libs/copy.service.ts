import type {
  ChapterContentComicRequestDto,
  DetailComicRequestDto,
  SearchComicRequestDto,
} from '@libs/content/work'
import { BadRequestException, Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'

/**
 * 拷贝漫画平台服务
 * 提供拷贝漫画平台的内容解析功能
 */
@Injectable()
export class CopyService {
  private readonly httpClient: AxiosInstance
  private readonly baseUrl = 'https://api.copy2000.online'
  private readonly headers = {
    platform: 3,
    version: '3.0.6',
  }

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: this.headers,
      timeout: 10000,
    })
  }

  /**
   * 搜索漫画关键词
   */
  async searchWord(dto: SearchComicRequestDto) {
    try {
      const { data } = await this.httpClient.get('/api/v3/search/comic', {
        params: {
          q: dto.keyword,
          limit: dto.pageSize,
          offset: dto.pageIndex,
        },
      })
      if (data.code !== 200) {
        throw new Error('解析服务出现错误，请稍后再试！')
      }
      return {
        total: data.results.total,
        pageIndex: data.results.offset,
        pageSize: data.results.limit,
        list: data.results.list.map((item: any) => ({
          id: item.path_word,
          name: item.name,
          cover: item.cover,
          author: item.author.map((author: any) => author.name),
          source: '拷贝',
          platform: 'copy',
        })),
      }
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : undefined
      throw new BadRequestException(
        typeof error === 'string'
          ? error
          : detail || '解析服务出现错误，请稍后再试！',
      )
    }
  }

  /**
   * 解析漫画内容
   * @returns 漫画详情
   */
  async parseWord() {
    return undefined
  }

  /**
   * 获取漫画详情
   * @returns 漫画详情数据
   * @param dto
   */
  async detail(dto: DetailComicRequestDto) {
    try {
      const { data } = await this.httpClient.get(
        `/api/v3/comic2/${dto.comicId}?in_mainland=true&platform=3`,
      )
      if (data.code !== 200) {
        throw new Error('解析服务出现错误，请稍后再试！')
      }
      return data.results
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : undefined
      throw new BadRequestException(
        typeof error === 'string'
          ? error
          : detail || '解析服务出现错误，请稍后再试！',
      )
    }
  }

  /**
   * 获取章节列表
   * @param dto 请求参数
   * @returns 章节列表
   */
  async chapter(dto: DetailComicRequestDto) {
    try {
      const { data } = await this.httpClient.get(
        `/api/v3/comic/${dto.comicId}/group/default/chapters?limit=500&offset=0&in_mainland=true&platform=3`,
      )
      if (data.code !== 200) {
        throw new Error('解析服务出现错误，请稍后再试！')
      }
      return data.results.list
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : undefined
      throw new BadRequestException(
        typeof error === 'string'
          ? error
          : detail || '解析服务出现错误，请稍后再试！',
      )
    }
  }

  /**
   * 获取章节内容
   * @param dto 请求参数
   * @returns 章节内容
   */
  async content(dto: ChapterContentComicRequestDto) {
    try {
      const { data } = await this.httpClient.get(
        `/api/v3/comic/${dto.comicId}/chapter2/${dto.chapterId}?in_mainland=true&platform=3`,
      )
      if (data.code !== 200) {
        throw new Error('解析服务出现错误，请稍后再试！')
      }
      return data.results
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : undefined
      throw new BadRequestException(
        typeof error === 'string'
          ? error
          : detail || '解析服务出现错误，请稍后再试！',
      )
    }
  }
}
