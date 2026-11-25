import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { GatewayRequest, GatewayResponse } from '../contract/gateway.types';
import { OrchestratorService } from '../orchestrator/orchestrator.service';

@Controller()
export class GatewayController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  /** The URL declared to the sandbox for each channel, for example https://<host>/middleware */
  @Post('middleware')
  @HttpCode(200)
  handle(@Body() body: GatewayRequest): Promise<GatewayResponse> {
    return this.orchestrator.handle(body);
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
