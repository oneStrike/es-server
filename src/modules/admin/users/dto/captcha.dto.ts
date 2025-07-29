import { ValidateString } from '@/common/decorators/validate.decorator';

export class CaptchaDto {
  @ValidateString({
    description: '验证码 key',
    example: '1234',
    required: true,
  })
  id: string;

  @ValidateString({
    description: '验证码',
    example: '',
    required: true,
  })
  data: string;
}
