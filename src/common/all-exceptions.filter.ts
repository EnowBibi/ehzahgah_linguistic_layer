import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { safeFallback } from '../contract/response.guard';

/** Any error that escapes the pipeline becomes a valid contract reply, never a 500. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('AllExceptions');

  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    this.log.error(error instanceof Error ? error.stack ?? error.message : String(error));
    res.status(200).json(safeFallback('Service temporarily unavailable. Please try again.', null));
  }
}
