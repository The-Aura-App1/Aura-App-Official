# Lambda role policies

Least-privilege permissions for each `aura-*` Lambda role. Each file lists only
the tables, indexes and actions that Lambda's code uses, plus S3 uploads for the
two Lambdas that hand out upload URLs. They replace the broad
`AmazonDynamoDBFullAccess` and `AmazonS3FullAccess` policies.

| File | Role |
|---|---|
| `aura-users.json` | `aura-users-role-p1n6vl88` |
| `aura-posts.json` | `aura-posts-role-1gqtmjyp` |
| `aura-aura.json` | `aura-aura-role-2td8veox` |
| `aura-groups.json` | `aura-groups-role-8dybu3xk` |
| `aura-comments.json` | `aura-comments-role-b7l3nihf` |
| `aura-notifications.json` | `aura-notifications-role-6h91ezik` |

Every role also keeps:

- its `AWSLambdaBasicExecutionRole-…` policy (CloudWatch logs)
- `aura-rate-limits-access` (rate-limit counters in `aura-rate-limits`)

## Applying a policy (IAM console, one role at a time)

1. **IAM → Policies → Create policy → JSON**, paste the file, name it
   `aura-<name>-access` (for example `aura-posts-access`), create it.
2. Attach it to the role in the table above.
3. On that role, detach `AmazonDynamoDBFullAccess` (and `AmazonS3FullAccess`
   on the users and posts roles).
4. Test the features that Lambda serves in the app. A missing permission shows
   up as a 500 "Internal server error", and as `AccessDeniedException` in the
   Lambda's CloudWatch logs.

**Rollback:** re-attach `AmazonDynamoDBFullAccess` (and `AmazonS3FullAccess`) to
the role. It takes effect within seconds.

## Keeping them current

When a Lambda starts using a new table, index, action or S3 folder, update its
file here and the policy in IAM before deploying, or the new code will fail
with `AccessDeniedException`.
