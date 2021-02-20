# GitHub actions for reSolve framework

## reimagined/github-actions/publish

Publishes framework packages to specified registry.

### Input

| Name | Description |
| ---- | ----------- |
| **registry** | Package registry to publish to. Provide **github**, **npm**, **npmjs** (same as **npm**) values to automatically determine desired well known registries, or custom URL for others. |
| **token** | Package registry auth token. |
| **version** | Semver compliant version to publish or **auto** to generate unique version automatically. |
| *build* | Used in conjunction with **version**=*auto*. The value set to semver *build* part (e.g. *1.0.3-build*). |
| *tag* | Packages version tag. (default: empty) |
| *unpublish* | Remove packages on post-job hook. (default: false) |
| *owner* | GitHub owner (only valid when registry set to 'github'). If no value provided the action will try to obtain it from package name scope. |

### Output

| Name | Description |
| ---- | ----------- |
| **registry_url** | Full registry URL where packages are published.  |
| **version** | Published packages version. |
| *tag* | Published packages tag. |



Workflow example:
```yaml
name: publish

on:
  push:
    branches: [ main ]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Publish
        uses: reimagined/github-actions/publish@v1
        with:
          registry: github
          token: {{ secrets.GITHUB_PAT }}
          version: auto
          build: 1234
          tag: dev
          unpublish: true
          owner: reimagined

```

## reimagined/github-actions/install-cloud

Install resolve cloud environment.

### Input

| Name | Description |
| ---- | ----------- |
| **aws_access_key_id** | AWS access key id |
| **aws_secret_access_key** | AWS secret access key |
| **stage** | Resolve cloud stage name |
| **source** | Local path to cloud sources |
| *version* | Bump framework packages version |
| *registry* | Custom NPM registry URL used to install packages **version** |
| *token* | Custom NPM registry auth token (e.g. personal access token for GitHub) |
| *scopes* | Comma-separated packages scope list (e.g. "**@reimagined**,**@babel**"). Restricts custom registry option to packages scopes.  |

### Output

| Name | Description |
| ---- | ----------- |
| **api_url** | Resolve cloud api url |



Workflow example:
```yaml
name: publish

on:
  push:
    branches: [ main ]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Wait other workflows
        uses: softprops/turnstyle@v1
        with:
          abort-after-seconds: 3600
          same-branch-only: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Deploy cloud
        uses: reimagined/github-actions/install-cloud@v1
        with:
          aws_access_key_id: {{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_access_key: {{ secrets.AWS_SECRET_ACCESS_KEY }}
          stage: dev
          version: 0.0.1
          source: ./resolve-cloud
          registry: https://npm.pkg.github.com/reimagined
          token: <GITHUB_PAT>
          scopes: @reimagined,@babel
```
