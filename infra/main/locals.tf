data "aws_caller_identity" "current" {}

locals {
  account_id            = data.aws_caller_identity.current.account_id
  app_url               = "https://${var.domain_name}"
  ssm_prefix            = "/${var.project}"
  lambda_names          = ["poller", "api", "tg-webhook"]
  poller_arn            = "arn:aws:lambda:${var.region}:${local.account_id}:function:${var.project}-poller"
}
