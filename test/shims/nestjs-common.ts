// Minimal stand-in for @nestjs/common in unit tests.
// Nest 12 ships ESM only (it uses import.meta), which Jest's CommonJS mode cannot load before Node 24.9.
// The services under test only need these decorators and a logger. The Nest wiring itself is
// checked by running the real application (npm run build, npm start, npm run simulate).
export const Injectable = () => (_target: unknown) => undefined;
export const Inject = (_token?: unknown) => (_target: unknown, _key: string | symbol | undefined, _index: number) => undefined;
export class Logger {
  constructor(_context?: string) {}
  log(_m: unknown) {}
  warn(_m: unknown) {}
  error(_m: unknown) {}
}
export interface OnModuleInit {
  onModuleInit(): void;
}
