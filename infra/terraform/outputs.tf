output "static_bucket" {
  value = aws_s3_bucket.static.bucket
}

output "data_bucket" {
  value = aws_s3_bucket.data.bucket
}
