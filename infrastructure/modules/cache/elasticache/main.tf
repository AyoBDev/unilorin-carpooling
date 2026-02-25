variable "name_prefix" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "tags" { type = map(string) }

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.name_prefix}-redis-subnet"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${var.name_prefix}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = var.security_group_ids
  tags                 = var.tags
}

output "redis_endpoint" { value = aws_elasticache_cluster.main.cache_nodes[0].address }
