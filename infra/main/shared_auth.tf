# Sign-in comes from the shared Only Tools pool (only-tools-core publishes its ids in SSM).
# The old gighunter pool stays until the move is verified, then it is removed.
data "aws_ssm_parameter" "shared_pool_id" { name = "/onlytools/auth/user-pool-id" }
data "aws_ssm_parameter" "shared_pool_arn" { name = "/onlytools/auth/user-pool-arn" }
data "aws_ssm_parameter" "shared_issuer" { name = "/onlytools/auth/issuer" }
data "aws_ssm_parameter" "shared_client" { name = "/onlytools/auth/clients/gighunter" }
