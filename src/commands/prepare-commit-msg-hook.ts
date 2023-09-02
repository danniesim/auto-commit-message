import fs from 'fs/promises';
import winston from 'winston';
import { getChangedFiles, getDiff, getStagedFiles, gitAdd } from '../utils/git';
import { getConfig } from './config';
import { generateCommitMessageByDiff } from '../generateCommitMessageFromGitDiff';
import { sleep } from '../utils/sleep';

winston.add(new winston.transports.Console());

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
    winston.info('Commit source in args, skipping');
    return;
  }

  if (isStageAllFlag) {
    const changedFiles = getChangedFiles();

    if (changedFiles) gitAdd({ files: changedFiles });
    else {
      winston.info('No changes detected, write some code and run `oco` again');
      process.exit(1);
    }
  }

  const staged = getStagedFiles();

  if (!staged) return;

  winston.info('AutoCommitMessage');

  const config = getConfig();

  if (!config?.OCO_OPENAI_API_KEY) {
    throw new Error(
      'No OPEN_AI_API exists. Set your OPEN_AI_API=<key> in ~/.opencommit'
    );
  }

  winston.info('generating commit message...');

  let done: boolean = false;

  generateCommitMessageByDiff(
    getDiff(staged),
    (message: string | undefined) => {
      if (message) {
        winston.info('generated commit message to add');
        fs.readFile(messageFilePath).then((fileContent) => {
          fs.writeFile(
            messageFilePath,
            message + '\n' + fileContent.toString()
          ).then(() => done = true);
        });
      } else {
        winston.info("couldn't generate commit message");
        done = true
      }
    }
  );

  while (!done) {
    await sleep(1000);
  }
  winston.info('done');
};
