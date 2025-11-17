import { ApiProperty } from '@nestjs/swagger'
import { ValidateString } from '@/decorators/validate.decorator'

export class UploadFileDto {
  @ValidateString({
    description: '上传场景',
    required: false,
    default: 'shared',
    example: 'shared',
  })
  scene?: string
}

export class UploadResponseDto {
  @ApiProperty({
    description: '文件名',
    required: true,
    example: 'document_20231107.pdf',
  })
  filename!: string

  @ApiProperty({
    description: '文件路径',
    required: true,
    example: '/uploads/2023/11/07/document_20231107.pdf',
  })
  filePath!: string

  @ApiProperty({
    description: '文件场景',
    required: true,
    example: 'shared',
  })
  scene!: string

  @ApiProperty({
    description: '文件大小',
    required: true,
    example: 1024000,
  })
  fileSize!: number

  @ApiProperty({
    description: '文件类型mimeType',
    required: true,
    example: 'application/pdf',
  })
  mimeType!: string

  @ApiProperty({
    description: '文件类型',
    required: true,
    example: 'pdf',
  })
  fileType!: string

  @ApiProperty({
    description: '原始文件名',
    required: true,
    example: '原始文档.pdf',
  })
  originalName!: string

  @ApiProperty({
    description: '上传时间',
    required: true,
    example: '2023-11-07T10:30:00.000Z',
  })
  uploadTime!: Date
}
