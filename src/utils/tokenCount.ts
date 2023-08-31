import { Tiktoken } from '@dqbd/tiktoken/lite';
import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json' assert { type: 'json' };

const encoding = new Tiktoken(
  cl100k_base.bpe_ranks,
  cl100k_base.special_tokens,
  cl100k_base.pat_str
);

export function tokenCount(content: string): number {
  const tokens = encoding.encode(content);
  return tokens.length;
}
