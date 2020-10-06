# <%= name %>

A @tangro action to verify that all keys, collected with i18next-scanner have a translation.

# Version

You can use a specific `version` of this action. The latest published version is `<%= version %>`. You can also use `latest` to always get the latest version.

# Parameters:

```
configPath: string;
workingDirectory?: string;
```

# Example

```yml
jobs:
  translations:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout latest code
        uses: <%= actions.checkout %>
      - name: Use Node.js 12.x
        uses: <%= actions['setup-node'] %>
        with:
          node-version: 12.x
      - name: Authenticate with GitHub package registry
        run: echo "//npm.pkg.github.com/:_authToken=${{ secrets.ACCESS_TOKEN }}" >> ~/.npmrc
      - name: Run npm install
        run: npm install
      - name: Rum i18next-scanner
        run: npm run scan-translations
      - name: Check translations
        uses: <%= uses %>
        with:
          configPath: 'src/translations/i18next-scanner.config.js'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_CONTEXT: ${{ toJson(github) }}
```

> **Attention** Do not forget to pass `GITHUB_TOKEN` and the `GITHUB_CONTEXT`

Steps this example job will perform:

1. Check out the latest code
2. Use node
3. Run `npm install`
4. Rum i18next-scanner
5. (this action) Run the i18next action

# Using with a static file server

You can also publish the results to a static file server. The action will write the results into `i18next/index.html`.

You can publish the results with our custom [deploy actions](https://github.com/tangro/actions-deploy)

```yml
i18next:
  runs-on: ubuntu-latest
  steps:
    - name: Checkout latest code
      uses: <%= actions.checkout %>
    - name: Use Node.js 12.x
      uses: <%= actions['setup-node'] %>
      with:
        node-version: 12.x
    - name: Authenticate with GitHub package registry
      run: echo "//npm.pkg.github.com/:_authToken=${{ secrets.ACCESS_TOKEN }}" >> ~/.npmrc
    - name: Run npm install
      run: npm install
    - name: Rum i18next-scanner
      run: npm run scan-translations
    - name: Check translations
      uses: <%= uses %>
      with:
        configPath: 'src/translations/i18next-scanner.config.js'
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        GITHUB_CONTEXT: ${{ toJson(github) }}
    - name: Zip license check result
      if: always()
      run: |
        cd i18next
        zip --quiet --recurse-paths ../i18next.zip *
    - name: Deploy i18next result
      if: always()
      uses: <%= tangro['actions-deploy] %>
      with:
        context: auto
        zip-file: i18next.zip
        deploy-url: ${{secrets.DEPLOY_URL}}
        project: i18next
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        GITHUB_CONTEXT: ${{ toJson(github) }}
        DEPLOY_PASSWORD: ${{ secrets.DEPLOY_PASSWORD }}
        DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
```

> **Attention** Do not forget to use the correct `DEPLOY_URL` and provide all the tokens the actions need.

# Development

Follow the guide of the [tangro-actions-template](https://github.com/tangro/tangro-actions-template)

# Scripts

- `npm run update-readme` - Run this script to update the README with the latest versions.

  > You do not have to run this script, since it is run automatically by the release action

- `npm run update-dependencies` - Run this script to update all the dependencies
