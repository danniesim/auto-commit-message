import fs from 'fs/promises';
import path from 'path';
import { command } from 'cleye';
import { assertGitRepo, getCoreHooksPath } from '../utils/git.js';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { intro, outro } from '@clack/prompts';
import { COMMANDS } from '../CommandsEnum.js';
import { execaSync } from 'execa';


const HOOK_NAME = 'prepare-commit-msg';
const DEFAULT_SYMLINK_URL = path.join('.git', 'hooks', HOOK_NAME);

const getHooksPath = (): string => {
  try {
    const hooksPath = getCoreHooksPath();
    return path.join(hooksPath, HOOK_NAME);
  } catch (error) {
    try {
      // Git < 2.9 will throw error. Hence, alternative hook path query for Git < 2.9
      // This works for submodules too.
      const { stdout } = execaSync("git", ["rev-parse", "--git-path", "hooks"]);
      return path.join(stdout, HOOK_NAME);
    } catch (error) {
      return DEFAULT_SYMLINK_URL;
    }
  }
};

export const isHookCalled = (): boolean => {
  const hooksPath = getHooksPath();
  return process.argv[1].endsWith(hooksPath);
};

const isHookExists = (): boolean => {
  const hooksPath = getHooksPath();
  return existsSync(hooksPath);
};

export const hookCommand = command(
  {
    name: COMMANDS.hook,
    parameters: ['<set/unset>']
  },
  (argv) => {
    const HOOK_URL = __filename;
    // const HOOK_DIR = path.dirname(HOOK_URL);
    const SYMLINK_URL = getHooksPath();
    // const SYMLINK_DIR = path.dirname(SYMLINK_URL);
    assertGitRepo();

    const { setUnset: mode } = argv._;

    if (mode === 'set') {
      intro(`setting opencommit as '${HOOK_NAME}' hook at ${SYMLINK_URL}`);

      // if (isHookExists()) {
      //   let realPath;
      //   try {
      //     realPath = fs.realpath(SYMLINK_URL).;
      //   } catch (error) {
      //     outro(error as string);
      //     realPath = null;
      //   }

      //   if (realPath === HOOK_URL)
      //     return outro(`OpenCommit is already set as '${HOOK_NAME}'`);

      //   throw new Error(
      //     `Different ${HOOK_NAME} is already set. Remove it before setting opencommit as '${HOOK_NAME}' hook.`
      //   );
      // }

      fs.mkdir(path.dirname(SYMLINK_URL), { recursive: true }).then(() => {
        const hookUrlPosix = HOOK_URL.split(path.sep).join(path.posix.sep);
        fs.appendFile(SYMLINK_URL, '#!/usr/bin/env bash\nnode ' + hookUrlPosix + ' $@').then(
          () => {
            fs.chmod(SYMLINK_URL, 0o755).then(() => {
              outro(`${chalk.green('✔')} Hook is set`);
            });
          }
        );
      });
    }

    if (mode === 'unset') {
      intro(
        `unsetting opencommit as '${HOOK_NAME}' hook from ${SYMLINK_URL}`
      );

      if (!isHookExists()) {
        return outro(
          `OpenCommit wasn't previously set as '${HOOK_NAME}' hook, nothing to remove`
        );
      }

      fs.rm(SYMLINK_URL).then(() => {
        outro(`${chalk.green('✔')} Hook is removed`);
      });
    }

    throw new Error(
      `Unsupported mode: ${mode}. Supported modes are: 'set' or 'unset'`
    );
  }
);
