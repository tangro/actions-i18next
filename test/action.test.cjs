const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const ncc = require('@vercel/ncc');

const root = path.resolve(__dirname, '..');
const context = { repository: 'test/project', sha: 'test-sha' };

function fixture(t, translations, workingDirectory = '') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'actions-i18next-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = path.join(directory, 'project', workingDirectory);
  fs.mkdirSync(path.join(project, 'translations'), { recursive: true });
  fs.writeFileSync(
    path.join(project, 'scanner.config.js'),
    `module.exports = ${JSON.stringify({
      options: {
        lngs: ['en', 'de'],
        ns: ['common'],
        resource: { savePath: 'translations/{{lng}}-{{ns}}.json' }
      }
    })};`
  );
  for (const language of ['en', 'de']) {
    fs.writeFileSync(
      path.join(project, 'translations', `${language}-common.json`),
      JSON.stringify(translations[language])
    );
  }
  return {
    directory,
    project,
    env: {
      ...process.env,
      GITHUB_TOKEN: 'test-token',
      GITHUB_CONTEXT: JSON.stringify(context),
      RUNNER_WORKSPACE: directory,
      INPUT_CONFIGPATH: 'scanner.config.js',
      INPUT_WORKINGDIRECTORY: workingDirectory,
      NO_PROXY: '127.0.0.1',
      no_proxy: '127.0.0.1'
    }
  };
}

async function runAction(t, f) {
  f.requests = [];
  const server = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
    }
    f.requests.push({
      url: request.url,
      method: request.method,
      body: JSON.parse(body)
    });
    response.writeHead(201, { 'content-type': 'application/json' });
    response.end('{}');
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  f.env.GITHUB_API_URL = `http://127.0.0.1:${server.address().port}`;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'dist', 'index.js')], {
      cwd: f.directory,
      env: f.env,
      timeout: 15000
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', status => resolve({ status, stdout, stderr }));
  });
  for (const request of f.requests) {
    assert.equal(request.url, '/repos/test/project/statuses/test-sha');
    assert.equal(request.method, 'POST');
  }
  return result;
}

function statuses(f) {
  return f.requests.map(request => request.body);
}

test('the result shape and missing-translation report stay unchanged', async t => {
  const f = fixture(t, { en: { hello: 'Hello' }, de: { hello: '' } }, 'frontend');
  const entry = path.join(f.directory, 'check.cjs');
  const { code } = await ncc(path.join(root, 'lib', 'i18next.js'), {
    minify: true
  });
  fs.writeFileSync(entry, code);
  const { runCheckI18n } = require(entry);
  const cwd = process.cwd();
  const env = {
    RUNNER_WORKSPACE: process.env.RUNNER_WORKSPACE,
    INPUT_CONFIGPATH: process.env.INPUT_CONFIGPATH,
    INPUT_WORKINGDIRECTORY: process.env.INPUT_WORKINGDIRECTORY
  };
  try {
    process.chdir(f.directory);
    for (const name of Object.keys(env)) {
      process.env[name] = f.env[name];
    }
    const result = await runCheckI18n(context);
    assert.deepEqual(result, {
      metadata: [{ language: 'de', ns: 'common', key: 'hello' }],
      isOkay: false,
      text: '<html><body># Missing translations to key - language:de translationKey hello ns: common</body></html>',
      shortText: '1 keys without translations found.'
    });
    assert.equal(
      fs.readFileSync(path.join(f.directory, 'i18next', 'index.html'), 'utf8'),
      '<html><body><h1>Missing translations to keys</h1><strong>Language de:</strong><ul><li>hello (ns:common)</li></ul></body></html>'
    );
  } finally {
    process.chdir(cwd);
    for (const [name, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test('the standalone bundle succeeds with translated keys and posts commit statuses', async t => {
  const f = fixture(t, { en: { hello: 'Hello' }, de: { hello: 'Hallo' } });
  const result = await runAction(t, f);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(
    fs.readFileSync(path.join(f.directory, 'i18next', 'index.html'), 'utf8'),
    '<h1>All keys are translated</h1>'
  );
  const updates = statuses(f);
  assert.deepEqual(updates.map(update => update.state), ['pending', 'success']);
  assert.equal(updates[1].description, 'No keys without translations found.');
  assert.match(updates[1].context, /\/i18next$/);
});

test('the standalone bundle fails on missing translations in a workingDirectory', async t => {
  const f = fixture(t, { en: { hello: 'Hello' }, de: { hello: '' } }, 'frontend');
  const result = await runAction(t, f);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stdout, /::error::1 keys without translations found\./);
  assert.deepEqual(statuses(f).map(update => update.state), ['pending', 'failure']);
});

test('the standalone bundle reports configuration errors', async t => {
  const f = fixture(t, { en: {}, de: {} });
  fs.rmSync(path.join(f.project, 'scanner.config.js'));
  const result = await runAction(t, f);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stdout, /::error::CI failed at step: i18next/);
  assert.deepEqual(statuses(f).map(update => update.state), ['pending', 'failure']);
});

test('the standalone bundle rejects a missing GITHUB_CONTEXT before sending requests', async t => {
  const f = fixture(t, { en: {}, de: {} });
  delete f.env.GITHUB_CONTEXT;
  const result = await runAction(t, f);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stdout, /You have to set the GITHUB_CONTEXT in your configuration/);
  assert.deepEqual(f.requests, []);
});

test('the standalone bundle rejects a missing GITHUB_TOKEN before sending requests', async t => {
  const f = fixture(t, { en: {}, de: {} });
  delete f.env.GITHUB_TOKEN;
  const result = await runAction(t, f);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /You have to provide the GITHUB_TOKEN/);
  assert.deepEqual(f.requests, []);
});
