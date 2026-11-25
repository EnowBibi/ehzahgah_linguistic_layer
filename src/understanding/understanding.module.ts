import { Module } from '@nestjs/common';
import { LanguageModule } from '../language/language.module';
import { UnderstandingService } from './understanding.service';

@Module({ imports: [LanguageModule], providers: [UnderstandingService], exports: [UnderstandingService] })
export class UnderstandingModule {}
