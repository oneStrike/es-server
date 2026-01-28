import { ApiProperty } from '@nestjs/swagger'

export class FileUploadResponseDto {
  @ApiProperty({
    description: '文件名',
    example: 'avatar.jpg',
    required: true,
    maxLength: 255,
  })
  filename: string

  @ApiProperty({
    description: '原始文件名',
    example: 'avatar.jpg',
    required: true,
    maxLength: 255,
  })
  originalName: string

  @ApiProperty({
    description: '文件路径',
    example: '/uploads/avatar.jpg',
    required: true,
    maxLength: 500,
  })
  filePath: string

  @ApiProperty({
    description: '文件大小',
    example: 1024,
    required: true,
  })
  fileSize: number

  @ApiProperty({
    description: 'MIME 类型',
    example: 'image/jpeg',
    required: true,
    maxLength: 255,
  })
  mimeType: string

  @ApiProperty({
    description: '文件类型',
    example: 'image',
    required: true,
    maxLength: 255,
  })
  fileType: string

  @ApiProperty({
    description: '场景',
    example: 'avatar',
    required: true,
    maxLength: 255,
  })
  scene: string

  @ApiProperty({
    description: '上传时间',
    example: '2023-01-01T00:00:00.000Z',
    required: true,
  })
  uploadTime: Date
}
