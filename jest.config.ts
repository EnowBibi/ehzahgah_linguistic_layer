import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', target: 'ES2022', esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true, skipLibCheck: true, isolatedModules: true, resolveJsonModule: true, types: ['node', 'jest'] } }] },
  // Nest 12 is ESM only and Jest runs CommonJS here: unit tests use a small shim (see test/shims).
  moduleNameMapper: { '^@nestjs/common$': '<rootDir>/test/shims/nestjs-common.ts' },
  testEnvironment: 'node',
};

export default config;
