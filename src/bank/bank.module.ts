import { Module } from '@nestjs/common';
import { LanguageModule } from '../language/language.module';
import { BankClient } from './bank.client';
import { BankPort } from './bank.port';

@Module({
  imports: [LanguageModule],
  providers: [{ provide: BankPort, useClass: BankClient }],
  exports: [BankPort],
})
export class BankModule {}
