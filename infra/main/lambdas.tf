data "archive_file" "fn" {
  for_each    = toset(local.lambda_names)
  type        = "zip"
  source_dir  = "${path.module}/${var.lambda_dist_dir}/${each.key}"
  output_path = "${path.module}/.build/${each.key}.zip"
}

resource "aws_cloudwatch_log_group" "fn" {
  for_each          = toset(local.lambda_names)
  name              = "/aws/lambda/${var.project}-${each.key}"
  retention_in_days = 14
}

resource "aws_lambda_function" "poller" {
  function_name    = "${var.project}-poller"
  role             = aws_iam_role.fn["poller"].arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.fn["poller"].output_path
  source_code_hash = data.archive_file.fn["poller"].output_base64sha256
  # 300 s timeout < 15 min schedule, so two scheduled runs can never overlap.
  # (reserved_concurrent_executions is not used: the account's concurrency limit is 10, and AWS
  # requires >= 100 unreserved to allow reservations.)
  timeout     = 300
  memory_size = 512
  environment {
    variables = {
      TABLE_NAME   = aws_dynamodb_table.main.name
      SSM_PREFIX   = local.ssm_prefix
      APP_URL      = local.app_url
      LLM_PROVIDER = var.llm_provider
    }
  }
  depends_on = [aws_cloudwatch_log_group.fn]
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.project}-api"
  role             = aws_iam_role.fn["api"].arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.fn["api"].output_path
  source_code_hash = data.archive_file.fn["api"].output_base64sha256
  timeout          = 29
  memory_size      = 512
  environment {
    variables = {
      TABLE_NAME           = aws_dynamodb_table.main.name
      SSM_PREFIX           = local.ssm_prefix
      API_BASE_URL         = aws_apigatewayv2_api.main.api_endpoint
      POLLER_FUNCTION_NAME = "${var.project}-poller"
      USER_POOL_ID         = nonsensitive(data.aws_ssm_parameter.shared_pool_id.value)
      LLM_PROVIDER         = var.llm_provider
    }
  }
  depends_on = [aws_cloudwatch_log_group.fn]
}

resource "aws_lambda_function" "tg_webhook" {
  function_name    = "${var.project}-tg-webhook"
  role             = aws_iam_role.fn["tg_webhook"].arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.fn["tg-webhook"].output_path
  source_code_hash = data.archive_file.fn["tg-webhook"].output_base64sha256
  timeout          = 15
  memory_size      = 256
  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.main.name
      SSM_PREFIX = local.ssm_prefix
    }
  }
  depends_on = [aws_cloudwatch_log_group.fn]
}
