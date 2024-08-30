import * as fs from "fs";
import * as path from "path";
import {
  s3Bucket,
  s3BucketAcl,
  s3BucketCorsConfiguration,
  s3BucketOwnershipControls,
  s3BucketPolicy,
  s3BucketPublicAccessBlock,
  s3BucketWebsiteConfiguration,
  s3Object,
} from "@cdktf/provider-aws";
import { TerraformAsset, AssetType, Fn } from "cdktf";
import { Construct } from "constructs";
import { Statement } from "iam-floyd";
import * as mime from "mime-types";
import { WebsiteConfig, CorsConfig, normalPath } from ".";
import { AwsBeaconBase, IAwsBeacon, AwsBeaconProps, AwsSpec } from "..";
import { Policy } from "../iam";

export interface BucketProps extends AwsBeaconProps {
  /**
   * The path to static files to upload, relative to the Spec file.
   *
   * @example "./dist"
   * @default - No files are uploaded.
   */
  readonly path?: string;

  // TODO: Add support to pass domain props (for route53 alias?)

  /**
   * Enable public read access for all the files in the bucket.
   *
   * Enable this only if you're not using CDN (CloudFront) to serve files from the bucket.
   * Should only be turned on if you want to host public files directly from the bucket.
   *
   * @default `false`
   */
  readonly public?: boolean;

  /**
   * NamePrefix
   *
   * Must be lowercase and less than or equal to 37 characters in length.
   * A full list of bucket naming rules [may be found here](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html).
   *
   * @default - GridUUID
   */
  readonly namePrefix?: string;

  /**
   * Boolean that indicates all objects (including any locked objects)
   * should be deleted from the bucket when the bucket is destroyed
   * so that the bucket can be destroyed without error.
   *
   * These objects are not recoverable. This only deletes objects when
   * the bucket is destroyed, not when setting this parameter to true.
   *
   * Once this parameter is set to true, there must be a successful
   * terraform apply run before a destroy is required to update this
   * value in the resource state.
   *
   * Without a successful terraform apply after this parameter is set,
   * this flag will have no effect. If setting this field in the same
   * operation that would require replacing the bucket or destroying
   * the bucket, this flag will not work.
   *
   * Additionally when importing a bucket, a successful terraform apply
   * is required to set this value in state before it will take effect
   * on a destroy operation.
   *
   * @default false
   */
  readonly forceDestroy?: boolean;

  /**
   * Provides an S3 bucket website configuration resource.
   *
   * Important: Amazon S3 website endpoints do not support HTTPS or access points.
   * If you want to use HTTPS, you can use Amazon CloudFront to serve a static
   * website hosted on Amazon S3.
   *
   * For more information, see [Hosting Websites on S3](https://docs.aws.amazon.com/AmazonS3/latest/dev/WebsiteHosting.html).
   */
  readonly websiteConfig?: WebsiteConfig;

  /**
   * Provides an S3 bucket CORS configuration resource.
   *
   * For more information about CORS, go to
   * [Enabling Cross-Origin Resource Sharing](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
   * in the Amazon S3 User Guide.
   */
  readonly corsConfig?: CorsConfig;
}

export interface BucketOutputs {
  /**
   * AWS Bucket name
   * @attribute
   */
  readonly name: string;

  /**
   * AWS Bucket arn
   * @attribute
   */
  readonly arn: string;

  /**
   * The URL of the static website.
   * @attribute
   */
  readonly websiteUrl?: string;

  /**
   * The Domain name of the static website.
   * @attribute
   */
  readonly websiteDomainName?: string;

  /**
   * The IPv4 DNS name of the specified bucket.
   * @attribute
   */
  readonly domainName: string;

  /**
   * The regional domain name of the specified bucket.
   * @attribute
   */
  readonly regionalDomainName: string;
}

export interface IBucket extends IAwsBeacon {
  /**
   * Absolute local path to the static files.
   */
  readonly path?: string;

  /** Strongly typed outputs */
  readonly bucketOutputs: BucketOutputs;

  /**
   * If this bucket has been configured for static website hosting.
   */
  readonly isWebsite: boolean;

  /**
   * Enable public read access for all the files in the bucket.
   *
   * This explicitly disables the default S3 bucket security settings. This
   * should be done with caution, as all bucket objects become publicly exposed.
   *
   * You don't need to enable this if you're using CloudFront to serve files from the bucket.
   *
   * @default `false`
   */
  public?: boolean;

  /**
   * The https URL of an S3 object. For example:
   *
   * - `https://s3.us-west-1.amazonaws.com/onlybucket`
   * - `https://s3.us-west-1.amazonaws.com/bucket/key`
   * - `https://s3.cn-north-1.amazonaws.com.cn/china-bucket/mykey`
   * @param key The S3 key of the object. If not specified, the URL of the
   *      bucket is returned.
   * @returns an ObjectS3Url token
   */
  urlForObject(key?: string): string;

  /**
   * The S3 URL of an S3 object. For example:
   * - `s3://onlybucket`
   * - `s3://bucket/key`
   * @param key The S3 key of the object. If not specified, the S3 URL of the
   *      bucket is returned.
   * @returns an ObjectS3Url token
   */
  s3UrlForObject(key?: string): string;

  /**
   * Returns an ARN that represents all objects within the bucket that match
   * the key pattern specified. To represent all keys, specify ``"*"``.
   */
  arnForObjects(keyPattern: string): string;
}

/**
 * The `Bucket` beacon provides an [AWS S3 Bucket](https://aws.amazon.com/s3/).
 *
 * ```ts
 * new staticsite.Bucket(spec, "MyWebsite", {
 *   path: path.join(__dirname, "dist"),
 * });
 * ```
 *
 * #### Public read access
 *
 * Enable `public` read access for all the files in the bucket. Useful for hosting public files.
 *
 * ```ts
 * new staticsite.Bucket("MyBucket", {
 *   public: true
 * });
 * ```
 *
 * @resource aws_s3_bucket
 * @beacon-class staticsite.IBucket
 */

export class Bucket extends AwsBeaconBase implements IBucket {
  // TODO: Add static fromLookup?
  protected readonly resource: s3Bucket.S3Bucket;
  protected readonly websiteConfig?: s3BucketWebsiteConfiguration.S3BucketWebsiteConfiguration;
  protected readonly corsConfig?: s3BucketCorsConfiguration.S3BucketCorsConfiguration;

  /** @internal */
  private readonly _path?: string;
  public get path(): string | undefined {
    return this._path;
  }

  /** @internal */
  private readonly _isWebsite: boolean;
  public get isWebsite(): boolean {
    return this._isWebsite;
  }

  /** @internal */
  private readonly _outputs: BucketOutputs;
  public get bucketOutputs(): BucketOutputs {
    return this._outputs;
  }
  public get outputs(): Record<string, any> {
    return this.bucketOutputs;
  }

  public get bucketName(): string {
    return this.resource.bucket;
  }

  constructor(scope: Construct, name: string, props: BucketProps) {
    super(scope, name, props);

    const { namePrefix, websiteConfig, corsConfig } = props;
    this._isWebsite = false;

    let bucketPrefix = this.gridUUID;
    if (namePrefix) {
      bucketPrefix = `${bucketPrefix}-${namePrefix}`;
    }

    if (bucketPrefix.length > 37) {
      throw new Error(
        `gridUUID+namePrefix must be less than or equal to 37 characters in length. ${bucketPrefix} (length: ${bucketPrefix.length})`,
      );
    }

    this.resource = new s3Bucket.S3Bucket(this, "Resource", {
      bucketPrefix,
    });

    if (props.path) {
      // should we support absolute paths? path.isAbsolute(props.path)?
      this._path = path.resolve(props.path);
      const asset = new TerraformAsset(this, "PathAsset", {
        path: this._path,
        type: AssetType.DIRECTORY,
      });
      this.uploadAssetDir(this._path, asset.path);
    }

    if (websiteConfig && websiteConfig.enabled) {
      this._isWebsite = true;
      this.websiteConfig =
        new s3BucketWebsiteConfiguration.S3BucketWebsiteConfiguration(
          this,
          "WebsiteConfig",
          {
            bucket: this.resource.bucket,
            ...websiteConfig,
            indexDocument: websiteConfig?.indexDocument
              ? {
                  suffix: websiteConfig.indexDocument,
                }
              : {
                  suffix: "index.html",
                },
          },
        );
    }
    const statements: Statement.All[] = [];
    let publicAccessBlock:
      | s3BucketPublicAccessBlock.S3BucketPublicAccessBlock
      | undefined = undefined;
    //TODO: Where should we control Origin Access Request policy for Edge (CDN) if public is false?
    if (props.public) {
      const ownershipControls =
        new s3BucketOwnershipControls.S3BucketOwnershipControls(
          this,
          "OwnershipControls",
          {
            bucket: this.resource.bucket,
            rule: {
              objectOwnership: "BucketOwnerPreferred",
            },
          },
        );
      publicAccessBlock =
        new s3BucketPublicAccessBlock.S3BucketPublicAccessBlock(
          this,
          "PublicAccessBlock",
          {
            bucket: this.resource.bucket,
            blockPublicAcls: false,
            blockPublicPolicy: false,
            ignorePublicAcls: false,
            restrictPublicBuckets: false,
          },
        );
      new s3BucketAcl.S3BucketAcl(this, "PublicAcl", {
        bucket: this.resource.bucket,
        acl: "public-read",

        dependsOn: [ownershipControls, publicAccessBlock],
      });
      statements.push(
        new Statement.S3()
          .toGetObject()
          .on(this.arnForObjects("*"))
          .forPublic(),
        // // TODO: this breaks public access?
        // new Statement.S3()
        //   .deny()
        //   .allActions()
        //   .on(this.resource.arn, this.arnForObjects("*"))
        //   .ifAwsSecureTransport(false)
        //   .forPublic(),
      );
    }

    if (corsConfig) {
      this.corsConfig = new s3BucketCorsConfiguration.S3BucketCorsConfiguration(
        this,
        "CorsConfig",
        {
          bucket: this.resource.bucket,
          ...corsConfig,
        },
      );
    }

    if (statements.length > 0) {
      new s3BucketPolicy.S3BucketPolicy(this, "Policy", {
        bucket: this.resource.bucket,
        policy: Policy.document(...statements),
        dependsOn: publicAccessBlock ? [publicAccessBlock] : undefined,
      });
    }

    //register outputs
    this._outputs = {
      name: this.resource.bucket,
      arn: this.resource.arn,
      domainName: this.resource.bucketDomainName,
      regionalDomainName: this.resource.bucketRegionalDomainName,
      websiteDomainName: this.websiteConfig?.websiteDomain,
      websiteUrl: this.websiteConfig?.websiteEndpoint,
    };
  }

  /**
   * The https URL of an S3 object. Specify `regional: false` at the options
   * for non-regional URLs. For example:
   *
   * - `https://s3.us-west-1.amazonaws.com/onlybucket`
   * - `https://s3.us-west-1.amazonaws.com/bucket/key`
   * - `https://s3.cn-north-1.amazonaws.com.cn/china-bucket/mykey`
   *
   * @param key The S3 key of the object. If not specified, the URL of the
   *      bucket is returned.
   * @returns an ObjectS3Url token
   */
  public urlForObject(key?: string): string {
    const stack = AwsSpec.ofAwsBeacon(this);
    const prefix = `https://s3.${this.env.region}.${stack.urlSuffix}/`;
    if (typeof key !== "string") {
      return this.urlJoin(prefix, this.bucketName);
    }
    return this.urlJoin(prefix, this.bucketName, key);
  }

  /**
   * The S3 URL of an S3 object. For example:
   *
   * - `s3://onlybucket`
   * - `s3://bucket/key`
   *
   * @param key The S3 key of the object. If not specified, the S3 URL of the
   *      bucket is returned.
   * @returns an ObjectS3Url token
   */
  public s3UrlForObject(key?: string): string {
    const prefix = "s3://";
    if (typeof key !== "string") {
      return this.urlJoin(prefix, this.bucketName);
    }
    return this.urlJoin(prefix, this.bucketName, key);
  }

  /**
   * Returns an ARN that represents all objects within the bucket that match
   * the key pattern specified. To represent all keys, specify ``"*"``.
   *
   * If you need to specify a keyPattern with multiple components, concatenate them into a single string, e.g.:
   *
   *   arnForObjects(`home/${team}/${user}/*`)
   *
   */
  public arnForObjects(keyPattern: string): string {
    return `${this.resource.arn}/${keyPattern}`;
  }

  // https://github.com/aws/aws-cdk/blob/v2.140.0/packages/aws-cdk-lib/aws-s3/lib/bucket.ts#L953
  private urlJoin(...components: string[]): string {
    return components.reduce((result, component) => {
      if (result.endsWith("/")) {
        result = result.slice(0, -1);
      }
      if (component.startsWith("/")) {
        component = component.slice(1);
      }
      return `${result}/${component}`;
    });
  }

  // TODO: Handle deployments with custom lambdas instead?
  // https://github.com/aws/aws-cdk/blob/9946ab03672bf6664e8ec95a81ddb67c3bb2f63b/packages/%40aws-cdk/custom-resource-handlers/lib/aws-s3-deployment/bucket-deployment-handler/index.py
  private uploadAssetDir(basePath: string, assetPath: string): void {
    const files = fs.readdirSync(basePath, { withFileTypes: true });
    for (const file of files) {
      const baseFilename = path.join(basePath, file.name);
      const assetFilename = path.join(assetPath, file.name);
      if (file.isDirectory()) {
        this.uploadAssetDir(baseFilename, assetFilename);
      } else {
        this.uploadAsset(baseFilename, assetFilename);
      }
    }
  }

  private uploadAsset(basePath: string, assetPath: string) {
    if (!this._path || this._path === "") {
      // this should not happen
      throw new Error("uploadAsset called without a defined path");
    }
    const fileKey = normalPath(basePath.replace(this._path, ""));

    // copy from asset directory
    new s3Object.S3Object(this, `File${fileKey.replace(/\//g, "--")}`, {
      key: fileKey,
      bucket: this.resource.bucket,
      source: assetPath,
      sourceHash: Fn.filemd5(assetPath),
      contentType: mime.contentType(path.extname(assetPath)) || undefined,
    });
  }
}
