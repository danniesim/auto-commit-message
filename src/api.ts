import winston from 'winston';
import {
  OpenAI
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
let apiVersion = config?.OCO_OPENAI_API_VERSION;
let azureDeploymentName = config?.OCO_AZURE_DEPLOYMENT_NAME

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
  private openAI: OpenAI;

  constructor() {
    // if (basePath) {
    //   this.openAiApiConfiguration.basePath = basePath;
    // }
    if (config?.OCO_OPENAI_API_TYPE === "azure") {
      this.openAI = new OpenAI({
        apiKey,
        baseURL: `${basePath}/${azureDeploymentName}`,
        defaultQuery: { 'api-version': apiVersion },
        defaultHeaders: { 'api-key': apiKey },
      });
    } else {
      this.openAI = new OpenAI({
        apiKey
      });
    }
  }

  private sendRequest = (params: any, callback: (message: OpenAI.Chat.ChatCompletion) => void): any => {
    let tries = 1;
    const f = () => {
      this.openAI.chat.completions.create(params)
      .then((res: OpenAI.Chat.ChatCompletion) => {
        callback(res);
      })
      .catch((err) => {
        tries = tries + 1;
        if (err.status == 429 && tries < 10) {
          let resetReq =  Number(err.headers["x-ratelimit-reset-requests"].match(/(\d+)/)[0]);
          if (!err.response.headers["x-ratelimit-reset-requests"].endsWith("ms")) resetReq = resetReq * 1000;

          let resetTok = Number(err.headers["x-ratelimit-reset-tokens"].match(/(\d+)/)[0]);
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
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessage>,
    cb: (message: string | null) => void
  ) => {
    const params = {
      model: MODEL,
      messages,
      temperature: 0.2,
      top_p: 0.95,
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
