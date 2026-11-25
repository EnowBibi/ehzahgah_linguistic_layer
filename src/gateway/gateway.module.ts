import { Module } from '@nestjs/common';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { GatewayController } from './gateway.controller';

@Module({ imports: [OrchestratorModule], controllers: [GatewayController] })
export class GatewayModule {}
