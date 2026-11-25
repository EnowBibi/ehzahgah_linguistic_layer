import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { DialogueModule } from '../dialogue/dialogue.module';
import { GenerationModule } from '../generation/generation.module';
import { LanguageModule } from '../language/language.module';
import { OperationsModule } from '../operations/operations.module';
import { UnderstandingModule } from '../understanding/understanding.module';
import { OrchestratorService } from './orchestrator.service';

@Module({
  imports: [LanguageModule, UnderstandingModule, DialogueModule, OperationsModule, GenerationModule, ChannelsModule],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
