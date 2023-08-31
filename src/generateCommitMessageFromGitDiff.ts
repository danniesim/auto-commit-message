import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum
} from 'openai';
import { api } from './api';
import { DEFAULT_MODEL_TOKEN_LIMIT, getConfig } from './commands/config';
import { mergeDiffs } from './utils/mergeDiffs';
import { i18n, I18nLocals } from './i18n';
import { tokenCount } from './utils/tokenCount';
import { outro } from '@clack/prompts';

const config = getConfig();
const translation = i18n[(config?.OCO_LANGUAGE as I18nLocals) || 'en'];

const INIT_MESSAGES_PROMPT: Array<ChatCompletionRequestMessage> = [
  {
    role: ChatCompletionRequestMessageRoleEnum.System,
    // prettier-ignore
    content: `You are to act as the author of a commit message in git. Your mission is to create clean and comprehensive commit messages in the conventional commit convention and explain WHAT were the changes and WHY the changes were done. I'll send you an output of 'git diff --staged' command, and you convert it into a commit message.
${config?.OCO_EMOJI ? 'Use GitMoji convention to preface the commit.' : 'Do not preface the commit with anything.'}
${config?.OCO_DESCRIPTION ? 'Add a short description of WHY the changes are done after the commit message. Don\'t start it with "This commit", just describe the changes.' : "Don't add any descriptions to the commit, only commit message."}
Use the present tense. Lines must not be longer than 74 characters. Use ${translation.localLanguage} to answer.`
  },
  {
    role: ChatCompletionRequestMessageRoleEnum.User,
    content: `diff --git a/src/server.ts b/src/server.ts
index ad4db42..f3b18a9 100644
--- a/src/server.ts
+++ b/src/server.ts
@@ -10,7 +10,7 @@
import {
  initWinstonLogger();
  
  const app = express();
 -const port = 7799;
 +const PORT = 7799;
  
  app.use(express.json());
  
@@ -34,6 +34,6 @@
app.use((_, res, next) => {
  // ROUTES
  app.use(PROTECTED_ROUTER_URL, protectedRouter);
  
 -app.listen(port, () => {
 -  console.log(\`Server listening on port \${port}\`);
 +app.listen(process.env.PORT || PORT, () => {
 +  console.log(\`Server listening on port \${PORT}\`);
  });`
  },
  {
    role: ChatCompletionRequestMessageRoleEnum.Assistant,
    content: `${config?.OCO_EMOJI ? '🐛 ' : ''}${translation.commitFix}
${config?.OCO_EMOJI ? '✨ ' : ''}${translation.commitFeat}
${config?.OCO_DESCRIPTION ? translation.commitDescription : ''}`
  }
];

const generateCommitMessageChatCompletionPrompt = (
  diff: string
): Array<ChatCompletionRequestMessage> => {
  const chatContextAsCompletionRequest = [...INIT_MESSAGES_PROMPT];

  chatContextAsCompletionRequest.push({
    role: ChatCompletionRequestMessageRoleEnum.User,
    content: diff
  });

  return chatContextAsCompletionRequest;
};

export enum GenerateCommitMessageErrorEnum {
  tooMuchTokens = 'TOO_MUCH_TOKENS',
  internalError = 'INTERNAL_ERROR',
  emptyMessage = 'EMPTY_MESSAGE'
}

const INIT_MESSAGES_PROMPT_LENGTH = INIT_MESSAGES_PROMPT.map(
  (msg) => tokenCount(msg.content ?? '') + 4
).reduce((a, b) => a + b, 0);

const ADJUSTMENT_FACTOR = 20;

export const generateCommitMessageByDiff = (
  diff: string,
  cb: (message: string | undefined) => void
) => {
  const MAX_REQUEST_TOKENS =
    DEFAULT_MODEL_TOKEN_LIMIT -
    ADJUSTMENT_FACTOR -
    INIT_MESSAGES_PROMPT_LENGTH -
    config?.OCO_OPENAI_MAX_TOKENS;

  if (MAX_REQUEST_TOKENS < 100) {
    throw new Error(
      'MAX_REQUEST_TOKENS is too small. Please, decrease OCO_OPENAI_MAX_TOKENS or increase DEFAULT_MODEL_TOKEN_LIMIT'
    );
  }

  if (tokenCount(diff) >= MAX_REQUEST_TOKENS) {
    outro('diff is bigger than gpt context — split diff into file-diffs');
    getCommitMsgsPromisesFromFileDiffs(
      diff,
      MAX_REQUEST_TOKENS,
      (message: string | undefined) => {
        cb(message);
      }
    );
  } else {
    const messages = generateCommitMessageChatCompletionPrompt(diff);

    api.generateCommitMessage(messages, (commitMessage: string | undefined) => {
      if (!commitMessage)
        throw new Error(GenerateCommitMessageErrorEnum.emptyMessage);
      cb(commitMessage);
    });
  }
};

function getMessagesByChangesInFile(
  fileDiff: string,
  separator: string,
  maxChangeLength: number,
  cb: (messages: (string | undefined)[]) => void
) {
  const hunkHeaderSeparator = '@@ ';
  const [fileHeader, ...fileDiffByLines] = fileDiff.split(hunkHeaderSeparator);

  // merge multiple line-diffs into 1 to save tokens
  const mergedChanges = mergeDiffs(
    fileDiffByLines.map((line) => hunkHeaderSeparator + line),
    maxChangeLength
  );

  const lineDiffsWithHeader = [];
  for (const change of mergedChanges) {
    const totalChange = fileHeader + change;
    if (tokenCount(totalChange) > maxChangeLength) {
      // If the totalChange is too large, split it into smaller pieces
      outro('totalChange is too large, split it into smaller pieces');
      const splitChanges = splitDiff(totalChange, maxChangeLength);
      lineDiffsWithHeader.push(...splitChanges);
    } else {
      lineDiffsWithHeader.push(totalChange);
    }
  }

  let commitMsgsFromFileLineDiffs: (string | undefined)[] = [];

  lineDiffsWithHeader.forEach((lineDiff) => {
    const messages = generateCommitMessageChatCompletionPrompt(
      separator + lineDiff
    );

    api.generateCommitMessage(messages, (commitMessage: string | undefined) => {
      commitMsgsFromFileLineDiffs.push(commitMessage);
      if (commitMsgsFromFileLineDiffs.length === lineDiffsWithHeader.length)
        cb(commitMsgsFromFileLineDiffs);
    });
  });
}

function splitDiff(diff: string, maxChangeLength: number) {
  const lines = diff.split('\n');
  const splitDiffs = [];
  let currentDiff = '';

  for (let line of lines) {
    // If a single line exceeds maxChangeLength, split it into multiple lines
    while (tokenCount(line) > maxChangeLength) {
      outro('line exceeds maxChangeLength, split it into multiple lines');
      const subLine = line.substring(0, maxChangeLength);
      line = line.substring(maxChangeLength);
      splitDiffs.push(subLine);
    }

    // Check the tokenCount of the currentDiff and the line separately
    if (tokenCount(currentDiff) + tokenCount('\n' + line) > maxChangeLength) {
      // If adding the next line would exceed the maxChangeLength, start a new diff
      outro('adding the next line would exceed the maxChangeLength, start a new diff');
      splitDiffs.push(currentDiff);
      currentDiff = line;
    } else {
      // Otherwise, add the line to the current diff
      currentDiff += '\n' + line;
    }
  }

  // Add the last diff
  if (currentDiff) {
    splitDiffs.push(currentDiff);
  }

  return splitDiffs;
}

export function getCommitMsgsPromisesFromFileDiffs(
  diff: string,
  maxDiffLength: number,
  cb: (message: string | undefined) => void
) {
  const separator = 'diff --git ';

  const diffByFiles = diff.split(separator).slice(1);

  // merge multiple files-diffs into 1 prompt to save tokens
  const mergedFilesDiffs = mergeDiffs(diffByFiles, maxDiffLength);

  for (const fileDiff of mergedFilesDiffs) {
    if (tokenCount(fileDiff) >= maxDiffLength) {
      // if file-diff is bigger than gpt context — split fileDiff into lineDiff
      outro('file-diff is bigger than gpt context — split fileDiff into lineDiff');
      getMessagesByChangesInFile(
        fileDiff,
        separator,
        maxDiffLength,
        (messages: (string | undefined)[]) => {
          cb(messages.join('\n\n'));
        }
      );
    } else {
      outro('Generating commit message from file-diff');
      const messages = generateCommitMessageChatCompletionPrompt(
        separator + fileDiff
      );

      api.generateCommitMessage(messages, (commitMessage: string | undefined) => {
        cb(commitMessage);
      });
    }
  }
}