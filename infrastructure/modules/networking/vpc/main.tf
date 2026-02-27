# ─────────────────────────────────────────────────────────
# VPC Networking Module
# PSRide — University of Ilorin Carpooling Platform
#
# Path: modules/networking/vpc/main.tf
#
# Creates a production-ready VPC with:
#   - Public subnets  (2 AZs) — ALB, NAT gateway, CloudFront
#   - Private subnets (2 AZs) — Lambda (VPC mode), ElastiCache
#   - Internet Gateway for public internet access
#   - NAT Gateway (optional) for private subnet outbound traffic
#   - Route tables wired correctly per subnet tier
# ─────────────────────────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  az_count = min(2, length(data.aws_availability_zones.available.names))
  azs      = slice(data.aws_availability_zones.available.names, 0, local.az_count)
}

# ══════════════════════════════════════════════════════════
#  VPC
# ══════════════════════════════════════════════════════════

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpc" })
}

# ══════════════════════════════════════════════════════════
#  INTERNET GATEWAY (public internet access)
# ══════════════════════════════════════════════════════════

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

# ══════════════════════════════════════════════════════════
#  PUBLIC SUBNETS  (one per AZ)
# ══════════════════════════════════════════════════════════

resource "aws_subnet" "public" {
  count = local.az_count

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)          # 10.0.0.x, 10.0.1.x
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${count.index + 1}"
    Tier = "public"
  })
}

# ══════════════════════════════════════════════════════════
#  PRIVATE SUBNETS  (one per AZ)
# ══════════════════════════════════════════════════════════

resource "aws_subnet" "private" {
  count = local.az_count

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)          # 10.0.10.x, 10.0.11.x
  availability_zone = local.azs[count.index]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${count.index + 1}"
    Tier = "private"
  })
}

# ══════════════════════════════════════════════════════════
#  ELASTIC IPs FOR NAT GATEWAYS
# ══════════════════════════════════════════════════════════

resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : local.az_count) : 0
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-eip-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# ══════════════════════════════════════════════════════════
#  NAT GATEWAYS  (in public subnets for HA or single)
# ══════════════════════════════════════════════════════════

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : local.az_count) : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# ══════════════════════════════════════════════════════════
#  ROUTE TABLE — PUBLIC (via Internet Gateway)
# ══════════════════════════════════════════════════════════

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-rt-public" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count = local.az_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ══════════════════════════════════════════════════════════
#  ROUTE TABLES — PRIVATE (via NAT Gateway)
# ══════════════════════════════════════════════════════════

resource "aws_route_table" "private" {
  count  = local.az_count
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rt-private-${count.index + 1}"
  })
}

resource "aws_route" "private_nat" {
  count = var.enable_nat_gateway ? local.az_count : 0

  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id = var.single_nat_gateway ? aws_nat_gateway.main[0].id : aws_nat_gateway.main[count.index].id
}

resource "aws_route_table_association" "private" {
  count = local.az_count

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ══════════════════════════════════════════════════════════
#  VPC FLOW LOGS  (optional — for security auditing)
# ══════════════════════════════════════════════════════════

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  count             = var.enable_flow_logs ? 1 : 0
  name              = "/aws/vpc/flow-logs/${var.name_prefix}"
  retention_in_days = var.flow_log_retention_days
  tags              = var.tags
}

resource "aws_iam_role" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0
  name  = "${var.name_prefix}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0
  name  = "${var.name_prefix}-flow-logs-policy"
  role  = aws_iam_role.flow_logs[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_flow_log" "main" {
  count = var.enable_flow_logs ? 1 : 0

  iam_role_arn    = aws_iam_role.flow_logs[0].arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs[0].arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-flow-log" })
}
