# Allowlist for the Cognito pre-sign-up trigger. Edited later with `aws ssm put-parameter --overwrite`;
# Terraform ignores value drift so operators can add people without a plan/apply.
resource "aws_ssm_parameter" "allowed_emails" {
  name  = "${local.ssm_prefix}/auth/allowed-emails"
  type  = "SecureString"
  value = join(",", var.allowed_emails)
  lifecycle { ignore_changes = [value] }
}

# Claude Console API key (sk-ant-api…) for the direct Anthropic backend, read by the poller and API Lambdas at runtime.
# Terraform writes only a placeholder, through the write-only `value_wo`, so neither the placeholder nor the real key is
# ever stored in state (not even after a refresh). Set the real key out of band — see infra/README.md:
#   aws ssm put-parameter --profile yevhenii --name /gighunter/llm/anthropic-api-key --type SecureString --overwrite --value "$KEY"
# Bumping value_wo_version would overwrite the real key with the placeholder again.
# Standard tier: free. Encrypted with the AWS-managed aws/ssm key (no key fee).
resource "aws_ssm_parameter" "anthropic_api_key" {
  name             = "${local.ssm_prefix}/llm/anthropic-api-key"
  description      = "Claude Console API key for the GigHunter Lambdas; value set out of band"
  type             = "SecureString"
  tier             = "Standard"
  value_wo         = "unset"
  value_wo_version = 1
}
