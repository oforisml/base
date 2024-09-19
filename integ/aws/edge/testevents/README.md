# CloudFront Function Tests

## URL Rewrite to append index.html to URI for single page applications

Reference: [aws-samples/amazon-cloudfront-functions/url-rewrite-single-page-apps](https://github.com/aws-samples/amazon-cloudfront-functions/blob/main/url-rewrite-single-page-apps/README.md)

> There is a feature in CloudFront called the default root object that allows you to specify an index document that applies to the root object only, but not on any subfolders. For example, if you set up index.html as the default root object and a user goes to www.example.com, CloudFront automatically rewrites the request to www.example.com/index.html. But if a user goes to www.example.com/blog, this request is no longer on the root directory, and therefore CloudFront does not rewrite this URL and instead sends it to the origin as is. This function handles rewriting URLs for the root directory and all subfolders. Therefore, you don't need to set up a default root object in CloudFront when you use this function (although there is no harm in setting it up).
>
> Note: If you are using S3 static website hosting, you don't need to use this function. S3 static website hosting allows you to set up an index document. An index document is a webpage that Amazon S3 returns when any request lacks a filename, regardless of whether it's for the root of a website or a subfolder. This Amazon S3 feature performs the same action as this function.

## Verify a JSON Web Token (JWT) using SHA256 HMAC signature

Reference: [aws-samples/amazon-cloudfront-functions/kvs-jwt-verify](https://github.com/aws-samples/amazon-cloudfront-functions/blob/main/kvs-jwt-verify/README.md)

> CloudFront already provides a signed URLs feature that you can use instead of this function. A signed URL can include additional information, such as an expiration date and time, start date and time, and client IP address. This gives you more control over access to your content. However, creating a signed URL creates long and complex URLs and is more computationally costly to produce. If you need a simple and lightweight way to validate timebound URLs, this function can be easier than using CloudFront signed URLs.
