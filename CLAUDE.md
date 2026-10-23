# Aura app

## AWS rules

- Always run the AWS CLI with `--profile aura`. The profile points at account 570934198135, region us-east-1.
- Only touch Lambda functions whose names start with `aura-`.
- Never touch `postits-ai-proxy` or any other AWS resource. That includes other Lambdas, IAM, API Gateway, DynamoDB, S3, and so on.
- Ask before running anything that changes live AWS state, including `deploy.ps1`.

## Lambda code

- Source lives in `backend/lambdas/<name>/index.mjs` for these functions:
  `aura-users`, `aura-posts`, `aura-aura`, `aura-groups`, `aura-comments`, `aura-notifications`.
- Deploy one function with `.\deploy.ps1 -Name <name>`. The script only accepts the six names above. It builds the zip in a temp folder, deploys it, and prints the function's `LastModified` so you can confirm the deploy.
- `*.zip` files are gitignored. Never commit deployment packages.
