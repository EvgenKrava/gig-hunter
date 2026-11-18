# Infrastructure

Two Terraform roots, AWS profile `yevhenii`, region `us-east-1`.

## 1. Bootstrap (once)

Creates the S3 bucket that holds the main state.

```bash
cd infra/bootstrap
terraform init
terraform apply
# note the `state_bucket` output
```

Then write `infra/main/backend.hcl`:

```hcl
bucket = "gighunter-tfstate-<ACCOUNT_ID>"
```

## 2. Main

Prerequisites:

1. only-tools-core applied: sign-in comes from the shared Only Tools pool, whose ids this root reads from
   SSM (`/onlytools/auth/*`). Access is the `gighunter-user` role, granted in the Only Tools admin.
2. `infra/main/terraform.tfvars` (git-ignored):

   ```hcl
   alarm_email = "you@example.com"
   ```
3. Lambda bundles: `pnpm build` from the repo root.

```bash
cd infra/main
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Confirm the SNS subscription email after the first apply. ACM validation can take a few minutes.

## Claude backend

By default (`llm_provider = "anthropic"`) the Lambdas call Claude through the Claude API with **each user's own Claude API key**.
- **Where the key comes from:** users paste a Claude Console key (`sk-ant-api…`) under Settings → Claude API key. The API checks it with Anthropic (a free models call) before saving.
- **Where it is stored:** the SSM SecureString `/gighunter/users/<sub>/anthropic/api-key`, next to the user's other tokens. The Lambdas already read and write `/gighunter/users/*`, so no extra grants are needed. The key is never returned by the API: Settings shows only the last 4 characters and when the key was saved. A new key takes effect on the next run, with no deploy.
- **Billing:** usage is billed to each user's Anthropic account. Claude Haiku 5.5, the default model, costs $0.10 / $0.50 per million input / output tokens. A user without a key gets runs that record `claude_key_missing` and score nothing.
- **Subscriptions:** Claude Pro/Max subscription tokens (`sk-ant-oat…`) are refused, because they may not power a deployed app.

To go back to Bedrock, apply with `-var llm_provider=bedrock`. That gives the poller and API Lambdas the Bedrock grants and sets `LLM_PROVIDER=bedrock`; user keys are then ignored. The account gets 403 on every Claude 5.x model on Bedrock, so pick a 4.x model in Settings first.

For a local check of a key, run `pnpm llm:smoke` with `ANTHROPIC_API_KEY` set.

## Deploying changes

- Backend: `pnpm build && (cd infra/main && terraform apply)` — Terraform re-zips `apps/lambdas/dist/*` and updates functions whose hash changed.
- Frontend: `pnpm build:web && pnpm deploy:web` — builds `apps/web/dist` and syncs it to the web bucket, invalidating CloudFront.

## Destroy

`terraform destroy` in `infra/main` removes everything except the state bucket. The DynamoDB table has PITR on; export first if the data matters.
