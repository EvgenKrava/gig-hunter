variable "project" {
  type    = string
  default = "gighunter"
}
variable "aws_profile" {
  type    = string
  default = "yevhenii"
}
variable "region" {
  type    = string
  default = "us-east-1"
}
variable "domain_name" {
  type    = string
  default = "gighunter.onlytools.click"
}
variable "hosted_zone_name" {
  type    = string
  default = "onlytools.click"
}
variable "lambda_dist_dir" {
  type    = string
  default = "../../apps/lambdas/dist"
}
variable "llm_provider" {
  type        = string
  default     = "bedrock"
  description = "Claude backend for the Lambdas: anthropic (Claude API key from SSM) or bedrock (Lambda role, SigV4)"
  validation {
    condition     = contains(["anthropic", "bedrock"], var.llm_provider)
    error_message = "llm_provider must be \"anthropic\" or \"bedrock\"."
  }
}
variable "dev_origins" {
  type    = list(string)
  default = ["http://localhost:5173"]
}

variable "alarm_email" {
  type = string
}
