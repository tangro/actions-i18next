import * as core from '@actions/core';
import path from 'path';
import fs from 'fs';
import groupBy from 'lodash/groupBy';
import { GitHubContext, Result } from '@tangro/tangro-github-toolkit';

interface I18nCheck {
  key: string;
  ns?: string;
  language: string;
}

const toFileText = (i18nCheck: Array<I18nCheck>, isOkay: boolean): string => {
  if (isOkay) {
    return '<h1>All keys are translated</h1>';
  } else {
    const groupedI18nCheck = groupBy(i18nCheck, 'language');

    const text = [
      `<h1>Missing translations to keys</h1>${Object.keys(groupedI18nCheck)
        .map(
          languageKey =>
            `<strong>Language ${languageKey}:</strong><ul>${groupedI18nCheck[
              languageKey
            ].map(({ key, ns }) => `<li>${key} (ns:${ns})</li>`)}</ul>`
        )
        .join('')}`
    ];

    return `<html><body>${text}</body></html>`;
  }
};

const toComment = (i18nCheck: Array<I18nCheck>, isOkay: boolean): string => {
  if (isOkay) {
    return 'All keys are translated';
  } else {
    const text = [
      `# Missing translations to key ${i18nCheck
        .map(
          ({ language, key, ns }) =>
            `- language:${language} translationKey ${key} ns: ${ns}`
        )
        .join('\r\n\\')}`
    ];
    return `<html><body>${text}</body></html>`;
  }
};

export async function runCheckI18n(
  context: GitHubContext<{}>
): Promise<Result<Array<I18nCheck>>> {
  try {
    const notTranslatedKeys: Array<I18nCheck> = [];

    const [owner, repo] = context.repository.split('/');
    const workingDirectory = core.getInput('workingDirectory');
    const configPath = core.getInput('configPath');

    let rootPath;
    if (workingDirectory) {
      rootPath = path.join(
        process.env.RUNNER_WORKSPACE as string,
        repo,
        workingDirectory
      );
    } else {
      rootPath = path.join(process.env.RUNNER_WORKSPACE as string, repo);
    }

    const pathToConfig = path.join(rootPath, configPath);

    const config = require(path.resolve(pathToConfig));

    config.options.lngs.forEach(language => {
      config.options.ns.forEach(ns => {
        const filePath = path.join(
          rootPath,
          config.options.resource.savePath
            .replace('{{lng}}', language)
            .replace('{{ns}}', ns)
        );

        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);

        Object.keys(json).forEach(key => {
          if (json[key] === '') {
            notTranslatedKeys.push({
              language,
              ns,
              key
            });
          }
        });
      });
    });

    const isOkay = notTranslatedKeys.length === 0;
    const comment = toComment(notTranslatedKeys, isOkay);
    const fileContent = toFileText(notTranslatedKeys, isOkay);
    fs.mkdirSync('i18next');
    fs.writeFileSync(path.join('i18next', 'index.html'), fileContent);
    core.info(`Result written to ${path.join('i18next', 'index.html')}`);

    const result: Result<Array<I18nCheck>> = {
      metadata: notTranslatedKeys,
      isOkay,
      text: comment,
      shortText: isOkay
        ? `No keys without translations found.`
        : `${notTranslatedKeys.length} keys without translations found.`
    };
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
