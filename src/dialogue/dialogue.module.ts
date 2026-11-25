import { Module } from '@nestjs/common';
import { LanguageModule } from '../language/language.module';
import { DialogueService } from './dialogue.service';

@Module({ imports: [LanguageModule], providers: [DialogueService], exports: [DialogueService] })
export class DialogueModule {}
