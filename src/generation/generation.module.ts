import { Module } from '@nestjs/common';
import { LanguageModule } from '../language/language.module';
import { GenerationService } from './generation.service';

@Module({ imports: [LanguageModule], providers: [GenerationService], exports: [GenerationService] })
export class GenerationModule {}
