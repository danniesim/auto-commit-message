import winston from 'winston';
import {
  ChatCompletionRequestMessage,
  Configuration as OpenAiApiConfiguration,
  OpenAIApi,
  CreateChatCompletionResponse
} from 'openai';

import {
  CONFIG_MODES,
  getConfig
} from './commands/config';
import { tokenCount } from './utils/tokenCount';
import { GenerateCommitMessageErrorEnum } from './generateCommitMessageFromGitDiff';
import { execaSync } from 'execa';

const config = getConfig();

let maxTokens = config?.OCO_OPENAI_MAX_TOKENS;
let basePath = config?.OCO_OPENAI_BASE_PATH;
let apiKey = config?.OCO_OPENAI_API_KEY;

const [command, mode] = process.argv.slice(2);

if (!apiKey && command !== 'config' && mode !== CONFIG_MODES.set) {
  winston.info('AutoCommitMessage');

  winston.info(
    'OCO_OPENAI_API_KEY is not set, please run `oco config set OCO_OPENAI_API_KEY=<your token>. Make sure you add payment details, so API works.`'
  );
  winston.info(
    'For help look into README https://github.com/danniesim/opencommit#setup'
  );

  process.exit(1);
}

const MODEL = config?.OCO_MODEL || 'gpt-3.5-turbo-16k';

class OpenAi {
  private openAiApiConfiguration = new OpenAiApiConfiguration({
    apiKey: apiKey
  });
  private openAI!: OpenAIApi;

  constructor() {
    if (basePath) {
      this.openAiApiConfiguration.basePath = basePath;
    }
    this.openAI = new OpenAIApi(this.openAiApiConfiguration);
  }

  private sendRequest = (params: any, callback: (message: CreateChatCompletionResponse) => void): any => {
    let tries = 1;
    const f = () => {
      this.openAI.createChatCompletion(params)
      .then((res) => {
        callback(res.data);
      })
      .catch((err) => {
        tries = tries + 1;
        if (err.response.status == 429 && tries < 10) {
          let resetReq =  Number(err.response.headers["x-ratelimit-reset-requests"].match(/(\d+)/)[0]);
          if (!err.response.headers["x-ratelimit-reset-requests"].endsWith("ms")) resetReq = resetReq * 1000;

          let resetTok = Number(err.response.headers["x-ratelimit-reset-tokens"].match(/(\d+)/)[0]);
          if (!err.response.headers["x-ratelimit-reset-tokens"].endsWith("ms")) resetTok = resetTok * 1000;

          const delayMs = Math.max(resetReq, resetTok);
          winston.info(`Rate limit exceeded, retrying in ${delayMs / 1000} seconds... tries: ${tries}`)
          setTimeout(f, delayMs);
        } else {
          throw err;
        }
      });
    };
    f();
  }
  
  public generateCommitMessage = (
    messages: Array<ChatCompletionRequestMessage>,
    cb: (message: string | undefined) => void
  ) => {
    const params = {
      model: MODEL,
      messages,
      temperature: 0,
      top_p: 0.1,
      max_tokens: maxTokens || 500
    };
    const REQUEST_TOKENS = messages
      .map((msg) => tokenCount(msg.content ?? '') + 4)
      .reduce((a, b) => a + b, 0);

    const DEFAULT_MODEL_TOKEN_LIMIT = config?.OCO_DEFAULT_MODEL_TOKEN_LIMIT || 2048;

    if (REQUEST_TOKENS > DEFAULT_MODEL_TOKEN_LIMIT - maxTokens) {
      throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
    }

    this.sendRequest(params,
      (data: any) => {
        const message = data.choices[0].message;
        cb(message?.content);
      });
  }
}

export const getOpenCommitLatestVersion = ():
  string | undefined => {
  try {
    const { stdout } = execaSync('npm', ['view', 'auto-commit-message', 'version']);
    return stdout;
  } catch (_) {
    winston.info('Error while getting the latest version of auto-commit-message');
    return undefined;
  }
};


export const api = new OpenAi();
