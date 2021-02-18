# GitHub actions for reSolve framework

## reimagined/github-actions/publish

Publishes framework packages to specified registry.

### Input

| Name | Description |
| ---- | ----------- |
| **registry** | Package registry to publish to. Provide **github**, **npm**, **npmjs** (same as **npm**) values to automatically determine desired well known registries, or custom URL for others. |
| **token** | Package registry auth token. |
| **version** | Semver compliant version to publish or **auto** to generate unique version automatically. |
| *tag* | Packages version tag. (default: empty) |
| *unpublish* | Remove packages on post-job hook. (default: false)

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
          tag: dev
          unpublish: true

```

## reimagined/github-actions/deploy-cloud

Install resolve cloud environment.

### Input

| Name | Description |
| ---- | ----------- |
| **aws_access_key_id** | AWS access key id |
| **aws_secret_access_key** | AWS secret access key |
| **stage_name** | Resolve cloud stage name |
| **version** | Resolve version |
| **path** | Path to checkout repo |

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
        uses: reimagined/github-actions/deploy-cloud@v1
        with:
          aws_access_key_id: {{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_access_key: {{ secrets.AWS_SECRET_ACCESS_KEY }}
          stage_name: dev
          version: 0.0.1
          path: ./resolve-cloud

```
