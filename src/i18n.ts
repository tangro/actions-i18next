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
    const notTranslatedKeys: Array<I18nCheck> = [];

    const [owner, repo] = context.repository.split('/');
    const configPath = core.getInput('configPath');

    const pathToConfig = path.join(
      process.env.RUNNER_WORKSPACE as string,
      repo,
      configPath
    );

    const config = require(path.resolve(pathToConfig));
    console.log('config ', config);

    config.options.lngs.forEach(language => {
      const filePath = path.join(
        process.env.RUNNER_WORKSPACE as string,
        repo,
        config.options.resource.savePath.replace('{{lng}}', language)
      );

      console.log('filePath ', filePath);

      const content = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(content);

      console.log('Object.keys(json) ', Object.keys(json));

      Object.keys(json).forEach(key => {
        if (json[key] === '') {
          console.log('key without ', key);
          isOkay = false;
          notTranslatedKeys.push({
            language,
            key
          });
        }
      });
    });

    const result: Result<Array<I18nCheck>> = {
      metadata: notTranslatedKeys,
      isOkay: isOkay,
      text: markdownListI18n(notTranslatedKeys),
      shortText: isOkay
        ? `No keys without translations found.`
        : `${notTranslatedKeys.length} keys without translations found.`
    };

    console.log('result ', result);

    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
