import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { output, ZodType } from 'zod';

export interface ValidationIssue {
  /** Dotted field path, "" for the whole body. */
  path: string;
  message: string;
}

/** Validates and parses a request value with a zod schema from @gold/shared. 400 on failure. */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform<unknown, output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new BadRequestException({ statusCode: 400, message: 'Validation failed', issues });
    }
    return result.data;
  }
}
