// ~~ Generated by projen. To modify, edit .projenrc.ts and run "npx projen".
import type { HttpMethods } from './';

/**
 * Set of origins and methods (cross-origin access that you want to allow).
 */
export interface CorsRuleConfig {
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.60.0/docs/resources/s3_bucket_cors_configuration#max_age_seconds S3BucketCorsConfiguration#max_age_seconds}.
   * @stability stable
   */
  readonly maxAgeSeconds?: number;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.60.0/docs/resources/s3_bucket_cors_configuration#id S3BucketCorsConfiguration#id}.
   * Please be aware that the id field is automatically added to all resources in Terraform providers using a Terraform provider SDK version below 2.
   * If you experience problems setting this value it might not be settable. Please take a look at the provider documentation to ensure it should be settable.
   * @stability stable
   */
  readonly id?: string;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.60.0/docs/resources/s3_bucket_cors_configuration#expose_headers S3BucketCorsConfiguration#expose_headers}.
   * @stability stable
   */
  readonly exposeHeaders?: Array<string>;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.60.0/docs/resources/s3_bucket_cors_configuration#allowed_headers S3BucketCorsConfiguration#allowed_headers}.
   * @stability stable
   */
  readonly allowedHeaders?: Array<string>;
  /**
   * Docs at Terraform Registry: {@link https://registry.terraform.io/providers/hashicorp/aws/5.60.0/docs/resources/s3_bucket_cors_configuration#allowed_origins S3BucketCorsConfiguration#allowed_origins}.
   * @stability stable
   */
  readonly allowedOrigins: Array<string>;
  /**
   * Set of HTTP methods that you allow the origin to execute.
   * @stability stable
   */
  readonly allowedMethods: Array<HttpMethods>;
}
