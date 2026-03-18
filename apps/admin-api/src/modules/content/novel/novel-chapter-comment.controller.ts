import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('内容管理/小说章节评论模块')
@Controller('admin/work/novel-chapter-comment')
export class NovelChapterCommentController {}
