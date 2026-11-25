import { ChannelService } from '../../src/channels/channel.service';
import { loadConfig } from '../../src/config/config';
import { GatewayRequest, GatewayResponse } from '../../src/contract/gateway.types';
import { responseProblems } from '../../src/contract/response.guard';
import { DialogueService } from '../../src/dialogue/dialogue.service';
import { GenerationService } from '../../src/generation/generation.service';
import { LanguageService } from '../../src/language/language.service';
import { OperationsService } from '../../src/operations/operations.service';
import { OrchestratorService } from '../../src/orchestrator/orchestrator.service';
import { UnderstandingService } from '../../src/understanding/understanding.service';
import { FakeBank } from './fake-bank';

export function build() {
  const config = loadConfig({} as NodeJS.ProcessEnv);
  const languages = new LanguageService(config);
  languages.load('locales');
  const bank = new FakeBank();
  const dialogue = new DialogueService(languages);
  const orchestrator = new OrchestratorService(
    config,
    languages,
    new UnderstandingService(languages),
    dialogue,
    new OperationsService(bank),
    new GenerationService(languages),
    new ChannelService(),
  );
  let n = 0;
  const ask = async (
    text: string,
    o: { language?: string | null; channel?: GatewayRequest['channel']; trace?: string; session?: string; phone?: string } = {},
  ): Promise<GatewayResponse> => {
    const channel = o.channel ?? 'web';
    const res = await orchestrator.handle({
      trace_id: o.trace ?? `t${++n}`,
      team_id: 'test',
      channel,
      session_id: o.session ?? 's1',
      phone: o.phone ?? '237677000001',
      language: o.language === undefined ? 'en' : o.language,
      input: { type: 'text', text },
      constraints:
        channel === 'ussd'
          ? { max_chars: 182, charset: 'gsm7', mode: 'menu', timeout_ms: 3000 }
          : { charset: 'utf8', mode: 'ui_translation', timeout_ms: 10000 },
      bank_api: { base_url: 'http://fake' },
    });
    expect(responseProblems(res)).toEqual([]); // every reply must satisfy the contract
    return res;
  };
  return { ask, bank, dialogue, languages };
}
