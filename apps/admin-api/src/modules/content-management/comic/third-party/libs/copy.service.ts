import { BadRequestException, Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import {
  DetailComicRequestDto,
  SearchComicRequestDto,
} from '../dto/third-party.dto'

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
      throw new BadRequestException(
        typeof error === 'string'
          ? error
          : error.response?.data?.detail || '解析服务出现错误，请稍后再试！',
      )
    }
  }

  /**
   * 解析漫画内容
   * @returns 漫画详情
   */
  async parseWord() {
    // return this.detail(id)
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
      console.log(data)
      return data.code !== 200
        ? { code: 201 }
        : { code: 200, data: data.results }
    } catch (error) {
      console.log(error)
      return { code: 201 }
    }
  }

  /**
   * 获取章节列表
   * @param path 漫画路径
   * @returns 章节列表
   */
  async chapter(path: string) {
    try {
      const { data } = await this.httpClient.get(
        `/api/v3/comic/${path}/group/default/chapters?limit=500&offset=0&in_mainland=true&platform=3`,
      )
      return data.code !== 200
        ? { code: 201 }
        : { code: 200, data: data.results.list }
    } catch {
      return { code: 201 }
    }
  }

  /**
   * 获取章节内容
   * @param path 漫画路径
   * @param chapterId 章节ID
   * @returns 章节内容
   */
  async content(path: string, chapterId: string) {
    try {
      const { data } = await this.httpClient.get(
        `/api/v3/comic/${path}/chapter2/${chapterId}?in_mainland=true&platform=3`,
      )
      return data.code !== 200
        ? { code: 201 }
        : { code: 200, data: data.results }
    } catch {
      return { code: 201 }
    }
  }
}
