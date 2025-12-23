import { applyDecorators } from '@nestjs/common';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';

export function ApiFile(fieldName: string = 'file') {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          [fieldName]: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    }),
  );
}
