import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ValidatedUser } from '../auth.service';

/**
 * Decorator to get the current authenticated user from the request
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: ValidatedUser) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof ValidatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as ValidatedUser;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
