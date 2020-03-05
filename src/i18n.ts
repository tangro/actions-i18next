import * as core from '@actions/core';
import path from 'path';
import fs from 'fs';
import { GitHubContext } from '@tangro/tangro-github-toolkit';
import { Result } from './Result';

interface I18nCheck {
  key: string;
  language: string;
}

const markdownListI18n = (i18nCheck: Array<I18nCheck>): string => {
  return (
    '### List of all Keys without translations \n' +
    i18nCheck.map(
      keyResult =>
        `- language:${keyResult.language} translationKey ${keyResult.key}`
    )
  );
};

export async function runCheckI18n(
  context: GitHubContext<{}>
): Promise<Result<Array<I18nCheck>>> {
  try {
    let isOkay = true;
    const result: Array<I18nCheck> = [];

    const [owner, repo] = context.repository.split('/');
    const configPath = core.getInput('configPath');

    const pathToConfig = path.join(
      process.env.RUNNER_WORKSPACE as string,
      repo,
      configPath
    );

    const config = require(path.resolve(pathToConfig));
    config.options.lngs.forEach(language => {
      const path = config.options.resource.savePath.replace(
        '{{lng}}',
        language
      );
      const content = fs.readFileSync(path, 'utf8');
      const json = JSON.parse(content);

      Object.keys(json).forEach(key => {
        if (json[key] === '') {
          isOkay = false;
          result.push({
            language,
            key
          });
        }
      });
    });

    return {
      metadata: result,
      isOkay: isOkay,
      text: markdownListI18n(result),
      shortText: isOkay
        ? `No keys without translations found.`
        : `${result.length} keys without translations found.`
    } as Result<Array<I18nCheck>>;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
