import { Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from '../config/config';
import { LanguageService } from './language.service';

@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }, LanguageService],
  exports: [APP_CONFIG, LanguageService],
})
export class LanguageModule {}
