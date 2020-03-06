import * as core from '@actions/core';
import {
  GitHubContext,
  wrapWithSetStatus
} from '@tangro/tangro-github-toolkit';
import { runCheckI18n } from './i18next';

async function run() {
  try {
    if (
      !process.env.GITHUB_CONTEXT ||
      process.env.GITHUB_CONTEXT.length === 0
    ) {
      throw new Error(
        'You have to set the GITHUB_CONTEXT in your configuration'
      );
    }
    if (!process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN.length === 0) {
      throw new Error('You have to set the GITHUB_TOKEN in your configuration');
    }

    const context = JSON.parse(
      process.env.GITHUB_CONTEXT || ''
    ) as GitHubContext<{}>;

    const results = await wrapWithSetStatus(context, 'i18next', async () => {
      return await runCheckI18n(context);
    });

    if (results) {
      if (results.isOkay) {
      } else {
        console.log('setFailed', results.shortText);
        core.setFailed(results.shortText);
      }
    }

    // if (core.getInput('post-comment') === 'true' && result) {
    //   await createComment({
    //     context,
    //     comment: createCommentText(result)
    //   });
    // }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
