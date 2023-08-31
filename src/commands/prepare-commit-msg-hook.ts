import fs from 'fs/promises';
import { intro, outro, spinner } from '@clack/prompts';
import { getChangedFiles, getDiff, getStagedFiles, gitAdd } from '../utils/git';
import { getConfig } from './config';
import { generateCommitMessageByDiff } from '../generateCommitMessageFromGitDiff';
import { sleep } from '../utils/sleep';

const [messageFilePath, commitSource] = process.argv.slice(2);

export const prepareCommitMessageHook = async (
  isStageAllFlag: Boolean = false
) => {
  if (!messageFilePath) {
    throw new Error(
      'Commit message file path is missing. This file should be called from the "prepare-commit-msg" git hook'
    );
  }

  if (commitSource) {
    outro('Commit source in args, skipping');
    return;
  }

  if (isStageAllFlag) {
    const changedFiles = getChangedFiles();

    if (changedFiles) gitAdd({ files: changedFiles });
    else {
      outro('No changes detected, write some code and run `oco` again');
      process.exit(1);
    }
  }

  const staged = getStagedFiles();

  if (!staged) return;

  intro('opencommit');

  const config = getConfig();

  if (!config?.OCO_OPENAI_API_KEY) {
    throw new Error(
      'No OPEN_AI_API exists. Set your OPEN_AI_API=<key> in ~/.opencommit'
    );
  }

  const spin = spinner();
  spin.start('Generating commit message');

  let done: boolean = false;

  generateCommitMessageByDiff(
    getDiff(staged),
    (message: string | undefined) => {
      if (message) {
        outro('Generated commit message to add');
        fs.readFile(messageFilePath).then((fileContent) => {
          fs.writeFile(
            messageFilePath,
            message + '\n' + fileContent.toString()
          ).then(() => done = true);
        });
      } else {
        outro("Couldn't generate commit message");
      }
    }
  );

  while (!done) {
    await sleep(1000);
  }
  spin.stop('Done');
};
