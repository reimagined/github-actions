# GitHub actions for reSolve framework 

## reimagined/github-actions/publish@v1

Publishes framework packages to specified registry. 

### Input

| Name | Description |
| ---- | ----------- |
| **registry** | Package registry to publish to. Provide **github**, **npm**, **npmjs** values to automatically determine desired well known registries, or custom URL for others. |
| **token** | Package registry auth token. |
| **version** | Version to publish. |
| tag | Packages version tag. (default: empty) |
| unpublish | Remove packages on post-job hook. (default: false) 

### Output

| Name | Description |
| ---- | ----------- |
| **registry_url** | Full registry URL where packages are published.  |
| **version** | Published packages version. |
| **tag** | Published packages tag. |



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
