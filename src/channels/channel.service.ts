import { Injectable } from '@nestjs/common';
import { TurnContext } from '../common/turn-context';
import { fitSeptets, nonGsm7Chars, septetLength, transliterate } from './gsm7';

export interface Fitted {
  text: string;
  anomalies: string[];
}

/** Applies per-channel rules: length and alphabet. It must not change meaning. */
@Injectable()
export class ChannelService {
  fit(ctx: TurnContext, text: string): Fitted {
    const anomalies: string[] = [];
    const strictGsm = ctx.constraints.charset === 'gsm7';
    let out = text;

    if (strictGsm && nonGsm7Chars(out).length > 0) {
      if ((process.env.USSD_NON_GSM ?? 'transliterate') === 'transliterate') {
        out = transliterate(out);
        anomalies.push('TRANSLITERATED');
      } else {
        anomalies.push('NON_GSM7');
      }
    }

    const max = ctx.constraints.max_chars;
    if (max) {
      const stillNonGsm = nonGsm7Chars(out).length > 0;
      const limit = stillNonGsm ? Math.min(max, 70) : max; // UCS-2 drops the limit to 70
      const measure = (t: string) => (strictGsm && !stillNonGsm ? septetLength(t) : [...t].length);
      if (measure(out) > limit) {
        out = strictGsm && !stillNonGsm ? fitSeptets(out, limit).text : [...out].slice(0, limit).join('');
        anomalies.push('TRUNCATED');
      }
    }
    return { text: out, anomalies };
  }
}
