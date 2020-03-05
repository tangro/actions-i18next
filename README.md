# actions-i18next

A @tangro action to verify that all keys, collected with i18next-scanner have a translation.

# Example

```yml
jobs:
  translations:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout latest code
        uses: actions/checkout@v1
      - name: Use Node.js 12.x
        uses: actions/setup-node@v1
        with:
          node-version: 12.x
      - name: Authenticate with GitHub package registry
        run: echo "//npm.pkg.github.com/:_authToken=${{ secrets.ACCESS_TOKEN }}" >> ~/.npmrc
      - name: Run npm install
        run: npm install
      - name: Rum i18next-scanner
        run: npm run scan-translations
      - name: Check translations
        uses: tangro/actions-i18next@1.0.0
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

# Usage

# Development

Follow the guide of the [tangro-actions-template](https://github.com/tangro/tangro-actions-template)
