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

1. A Google OAuth client (Google Cloud Console → APIs & Services → Credentials → Create → OAuth client ID → Web application) with authorized redirect URI
   `https://gighunter-<ACCOUNT_ID>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`.
2. `infra/main/terraform.tfvars` (git-ignored):

   ```hcl
   google_client_id     = "....apps.googleusercontent.com"
   google_client_secret = "..."
   alarm_email          = "you@example.com"
   allowed_emails       = ["you@example.com"]
   ```
3. Lambda bundles: `pnpm build` from the repo root.

```bash
cd infra/main
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Confirm the SNS subscription email after the first apply. ACM validation can take a few minutes.

## Claude API key

The Lambdas call Claude through the Claude API (`llm_provider = "anthropic"`, the default). They read a Claude Console API key (`sk-ant-api…`, from platform.claude.com → API Keys) from the SSM SecureString `/gighunter/llm/anthropic-api-key`. Terraform creates the parameter with a placeholder, through a write-only attribute, so the key never lands in code, tfvars or state. After the first apply, store the real key without echoing it or leaving it in shell history:

```bash
read -rs KEY && aws ssm put-parameter --profile yevhenii --region us-east-1 \
  --name /gighunter/llm/anthropic-api-key --type SecureString --overwrite --value "$KEY"; unset KEY
```

The Lambdas cache the key per container. A rotated key takes effect on the next cold start, or right away after any deploy. A Claude Pro/Max subscription token (`sk-ant-oat…`) is refused: those may not power a deployed app.

Usage is billed per token by Anthropic: Claude Haiku 5.5 (the default model) costs $0.10 / $0.50 per million input / output tokens. The parameter itself is free: Standard tier, encrypted with the AWS-managed `aws/ssm` key.

To go back to Bedrock, apply with `-var llm_provider=bedrock`. That swaps the Lambdas' SSM-key grant for the Bedrock grants and sets `LLM_PROVIDER=bedrock`. Note that the account gets 403 on every Claude 5.x model on Bedrock, so pick a 4.x model in Settings first.

For local runs (`pnpm poller:local`, `pnpm llm:smoke`), `ANTHROPIC_API_KEY` in the environment takes precedence over SSM.

## Deploying changes

- Backend: `pnpm build && (cd infra/main && terraform apply)` — Terraform re-zips `apps/lambdas/dist/*` and updates functions whose hash changed.
- Frontend: `pnpm build:web && pnpm deploy:web` — builds `apps/web/dist` and syncs it to the web bucket, invalidating CloudFront.

## Destroy

`terraform destroy` in `infra/main` removes everything except the state bucket. The DynamoDB table has PITR on; export first if the data matters.
