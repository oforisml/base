import {
  s3Bucket,
  s3BucketAcl,
  s3BucketCorsConfiguration,
  s3BucketOwnershipControls,
  s3BucketPolicy,
  s3BucketPublicAccessBlock,
  s3BucketWebsiteConfiguration,
  s3BucketLifecycleConfiguration,
  s3BucketVersioning,
} from "@cdktf/provider-aws";
import { sleep } from "@cdktf/provider-time";
import { ITerraformDependable } from "cdktf";
import { Construct } from "constructs";
import { Statement } from "iam-floyd";
import {
  BucketSource,
  BucketSourceProps,
  WebsiteConfig,
  CorsConfig,
  LifecycleConfigurationRule,
  OriginAccessIdentity,
} from ".";
import { AwsBeaconBase, IAwsBeacon, AwsBeaconProps, AwsSpec } from "..";
import { Policy } from "../iam";

export interface CloudfrontAccessConfig {
  /**
   * Enable Cloudfront access via Origin Access Identity.
   */
  readonly enabled: boolean;
  /**
   * Object key patterns for cloudfront access.
   *
   * @default "*"
   */
  readonly keyPatterns?: string[];
}

export interface BucketProps extends AwsBeaconProps {
  /**
   * The path(s) to static directories or files to upload, relative to the Spec file.
   *
   * @example "./dist"
   * @default - No files are uploaded.
   */
  readonly sources?: string | string[] | AddSourceOptions[];

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
   * If you want to use HTTPS, you can use edge Distribution to serve a static
   * website hosted in a bucket.
   *
   * Use OriginAccessIdentity property to control ingress through edge Distribution.
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

  /**
   * One or more Lifecycle rules. Each rule consists of the following:
   *
   *  - Rule id
   *  - Filter identifying objects to which the rule applies
   *  - One or more transition or expiration actions
   *
   * For more information see the Amazon S3 User Guide on [Lifecycle Configuration Elements](https://docs.aws.amazon.com/AmazonS3/latest/userguide/intro-lifecycle-rules.html).
   */
  readonly lifecycleRules?: LifecycleConfigurationRule[];

  /**
   * Controls versioning on the S3 bucket.
   *
   * Setting this to false will suspend versioning if the associated S3 bucket is versioned.
   *
   * If you are enabling versioning on the bucket for the first time, AWS recommends that you wait for 15 minutes after enabling versioning before issuing write operations (PUT or DELETE) on objects in the bucket.
   * This will cause 15m delay if `path` is configured.
   *
   * @default false
   */
  readonly versioned?: boolean;

  /**
   * Enforces SSL for requests. S3.5 of the AWS Foundational Security Best Practices Regarding S3.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-ssl-requests-only.html
   *
   * @default false
   */
  readonly enforceSSL?: boolean;

  /**
   * Enforces minimum TLS version for requests.
   *
   * Requires `enforceSSL` to be enabled.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/userguide/amazon-s3-policy-keys.html#example-object-tls-version
   *
   * @default No minimum TLS version is enforced.
   */
  readonly minimumTLSVersion?: number;

  /**
   * Enable Cloudfront access via Origin Access Identity.
   *
   * Note: recommended to migrate to OAC in future.
   *
   * @default - no cloudfront access
   */
  readonly cloudfrontAccess?: CloudfrontAccessConfig;

  // TODO: Add flag to register Bucket Source outputs?
}

/**
 * Outputs which may be registered for output via the Grid.
 */
export interface BucketOutputs {
  /**
   * AWS Bucket name
   * @attribute
   */
  readonly bucketName: string;

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

  /**
   * Origin Access Identity, if cloudfrontAccess is enabled.
   * @attribute
   */
  readonly originAccessIdentity?: string;
}

/**
 * Imported or created Bucket attributes
 */
export interface IBucket extends IAwsBeacon {
  /** Strongly typed outputs */
  readonly bucketOutputs: BucketOutputs;

  /** Whether the bucket has versioning enabled */
  readonly versioned: boolean;

  /** The hosted Zone Id for the bucket */
  readonly hostedZoneId: string;

  /**
   * The Domain name of the static website.
   * @attribute
   */
  readonly websiteDomainName?: string;

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
   * Add a source of files for upload to the bucket.
   */
  addSource(props: AddSourceOptions, sourceId?: string): string;

  /**
   * If this bucket has been configured for static website hosting.
   */
  isWebsite(): this is {
    websiteDomainName: string;
    bucketOutputs: { websiteUrl: string; websiteDomainName: string };
  };

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
 * new storage.Bucket(spec, "MyWebsite", {
 *   path: path.join(__dirname, "dist"),
 * });
 * ```
 *
 * #### Public read access
 *
 * Enable `public` read access for all the files in the bucket. Useful for hosting public files.
 *
 * ```ts
 * new storage.Bucket("MyBucket", {
 *   public: true
 * });
 * ```
 *
 * @resource aws_s3_bucket
 * @beacon-class storage.IBucket
 */

export class Bucket extends AwsBeaconBase implements IBucket {
  // TODO: Add static fromLookup?
  protected readonly resource: s3Bucket.S3Bucket;
  protected readonly websiteConfig?: s3BucketWebsiteConfiguration.S3BucketWebsiteConfiguration;
  protected readonly corsConfig?: s3BucketCorsConfiguration.S3BucketCorsConfiguration;

  /** @internal */
  private readonly sources: SourceIndex[] = [];
  /** @internal */
  private readonly _versioned: boolean;
  public get versioned(): boolean {
    return this._versioned;
  }

  /** @internal */
  private readonly _isWebsite: boolean;
  /** @internal */
  private sourceSleep?: sleep.Sleep;

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
  public get hostedZoneId(): string {
    return this.resource.hostedZoneId;
  }
  public get websiteDomainName(): string | undefined {
    return this.websiteConfig?.websiteDomain;
  }

  private readonly statements: Statement.All[] = [];

  constructor(scope: Construct, name: string, props: BucketProps) {
    super(scope, name, props);

    const { namePrefix, websiteConfig, corsConfig, cloudfrontAccess } = props;
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

    this._versioned = props.versioned ?? false;
    if (this._versioned) {
      new s3BucketVersioning.S3BucketVersioningA(this, "Versioning", {
        bucket: this.resource.bucket,
        versioningConfiguration: {
          status: this._versioned ? "Enabled" : "Suspended",
        },
      });
    }

    if (props.sources) {
      if (typeof props.sources === "string") {
        this.addSource({ path: props.sources });
      } else if (Array.isArray(props.sources)) {
        for (const sourceProps of props.sources) {
          if (typeof sourceProps === "string") {
            this.addSource({ path: sourceProps });
          } else {
            this.addSource(sourceProps);
          }
        }
      }
    }

    if (props.lifecycleRules) {
      new s3BucketLifecycleConfiguration.S3BucketLifecycleConfiguration(
        this,
        "LifeCycleConfig",
        {
          bucket: this.resource.bucket,
          rule: props.lifecycleRules.map((rule) => ({
            ...rule,
            status: rule.enabled ? "Enabled" : "Disabled",
          })),
        },
      );
    }

    // Enforce AWS Foundational Security Best Practice
    if (props.enforceSSL) {
      this.enforceSSLStatement();
      this.minimumTLSVersionStatement(props.minimumTLSVersion);
    } else if (props.minimumTLSVersion) {
      throw new Error(
        "'enforceSSL' must be enabled for 'minimumTLSVersion' to be applied",
      );
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

    let bucketPolicyDependsOn: ITerraformDependable[] = [];
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
      const publicAccessBlock =
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
      this.statements.push(
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
      bucketPolicyDependsOn.push(publicAccessBlock);
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

    let originAccessIdentity: string | undefined;
    if (cloudfrontAccess?.enabled) {
      const oai = new OriginAccessIdentity(this, "OriginAccessIdentity", {
        comment: `OAI for ${this.resource.bucket}`,
      });
      originAccessIdentity = oai.cloudFrontOriginAccessIdentityPath;
      const stmt = new Statement.S3().allow().toGetObject().for(oai.iamArn);
      for (const keyPattern of cloudfrontAccess.keyPatterns ?? ["*"]) {
        stmt.on(this.arnForObjects(keyPattern));
      }
      bucketPolicyDependsOn.push(oai.resource);
      this.statements.push(stmt);
    }

    if (this.statements.length > 0) {
      new s3BucketPolicy.S3BucketPolicy(this, "Policy", {
        bucket: this.resource.bucket,
        policy: Policy.document(...this.statements),
        dependsOn:
          bucketPolicyDependsOn.length > 0 ? bucketPolicyDependsOn : undefined,
      });
    }

    //register outputs
    this._outputs = {
      bucketName: this.resource.bucket,
      arn: this.resource.arn,
      domainName: this.resource.bucketDomainName,
      regionalDomainName: this.resource.bucketRegionalDomainName,
      websiteDomainName: this.websiteConfig?.websiteDomain,
      websiteUrl: this.websiteConfig?.websiteEndpoint,
      originAccessIdentity,
    };
  }

  /**
   * Add a source to the bucket.
   *
   * @param props The properties of the source to add
   */
  public addSource(props: AddSourceOptions, sourceId?: string): string {
    if (this.versioned) {
      /**
       * If you enable versioning on a bucket for the first time, it might take up to 15 minutes
       * for the change to be fully propagated. We recommend that you wait for 15 minutes after
       * enabling versioning before issuing write operations (PUT or DELETE) on objects in the bucket.
       *
       * Write operations issued before this conversion is complete may apply to unversioned objects.
       */
      if (!this.sourceSleep) {
        this.sourceSleep = new sleep.Sleep(this, "VersioningSleep", {
          createDuration: "15m",
        });
      }
    }
    const indexedSource = this.sources.find(
      (sourceIndex) => sourceIndex.props === props,
    );
    if (indexedSource) {
      if (sourceId && sourceId !== indexedSource.id) {
        throw new Error(
          `Duplicate bucket source for ${indexedSource.id} and ${sourceId}.`,
        );
      }
      return indexedSource.id;
    }
    const nextIndex = this.sources.length;
    const id = sourceId ?? `source-${nextIndex}`;
    // ensure id (if provided) is unique within Bucket
    if (this.sources.some((sourceIndex) => sourceIndex.id === id)) {
      throw new Error(
        `Duplicate source id ${id}. SourceIds must be unique within a Bucket.`,
      );
    }
    this.sources.push({
      props: {
        ...props,
        bucket: this,
        dependsOn: this.sourceSleep ? [this.sourceSleep] : undefined,
      },
      id,
    });
    return id;
  }

  public isWebsite(): this is {
    websiteDomainName: string;
    bucketOutputs: { websiteUrl: string; websiteDomainName: string };
  } {
    return this._isWebsite;
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

  /**
   * Adds an iam statement to enforce SSL requests only.
   */
  private enforceSSLStatement() {
    this.statements.push(
      new Statement.S3()
        .deny()
        .allActions()
        .forPublic() // for any principal
        .on(this.resource.arn, this.arnForObjects("*"))
        .ifAwsSecureTransport(false),
    );
  }

  /**
   * Adds an iam statement to allow requests with a minimum TLS
   * version only.
   */
  private minimumTLSVersionStatement(minimumTLSVersion?: number) {
    if (!minimumTLSVersion) return;
    this.statements.push(
      new Statement.S3()
        .deny()
        .allActions()
        .forPublic()
        .on(this.resource.arn, this.arnForObjects("*"))
        .ifTlsVersion(minimumTLSVersion, "NumericLessThan"),
    );
  }

  /**
   * Adds resource to the Terraform JSON output at Synth time.
   *
   * called by TerraformStack.prepareStack()
   */
  public toTerraform(): any {
    /**
     * A preparing resolve might add new resources to the stack
     *
     * should not add resources if no bucket sources are defined
     */
    if (Object.keys(this.sources).length === 0) {
      return {};
    }

    for (const source of this.sources) {
      if (this.node.tryFindChild(source.id)) continue; // ignore if already generated
      new BucketSource(this, source.id, source.props);
    }
    return {};
  }
}

export interface AddSourceOptions {
  /**
   * Local path to the source files
   */
  readonly path: string;
  /**
   * Prefix to add to the uploaded objects
   */
  readonly prefix?: string;
}

// private interface to index Bucket sources by id
interface SourceIndex {
  props: BucketSourceProps;
  id: string;
}

/**
 * Storage class to move an object to
 */
export enum StorageClass {
  /**
   * Storage class for data that is accessed less frequently, but requires rapid
   * access when needed.
   *
   * Has lower availability than Standard storage.
   */
  INFREQUENT_ACCESS = "STANDARD_IA",

  /**
   * Infrequent Access that's only stored in one availability zone.
   *
   * Has lower availability than standard InfrequentAccess.
   */
  ONE_ZONE_INFREQUENT_ACCESS = "ONEZONE_IA",

  /**
   * Storage class for long-term archival that can take between minutes and
   * hours to access.
   *
   * Use for archives where portions of the data might need to be retrieved in
   * minutes. Data stored in the GLACIER storage class has a minimum storage
   * duration period of 90 days and can be accessed in as little as 1-5 minutes
   * using expedited retrieval. If you delete an object before the 90-day
   * minimum, you are charged for 90 days.
   */
  GLACIER = "GLACIER",

  /**
   * Storage class for long-term archival that can be accessed in a few milliseconds.
   *
   * It is ideal for data that is accessed once or twice per quarter, and
   * that requires immediate access. Data stored in the GLACIER_IR storage class
   * has a minimum storage duration period of 90 days and can be accessed in
   * as milliseconds. If you delete an object before the 90-day minimum,
   * you are charged for 90 days.
   */
  GLACIER_INSTANT_RETRIEVAL = "GLACIER_IR",

  /**
   * Use for archiving data that rarely needs to be accessed. Data stored in the
   * DEEP_ARCHIVE storage class has a minimum storage duration period of 180
   * days and a default retrieval time of 12 hours. If you delete an object
   * before the 180-day minimum, you are charged for 180 days. For pricing
   * information, see Amazon S3 Pricing.
   */
  DEEP_ARCHIVE = "DEEP_ARCHIVE",

  /**
   * The INTELLIGENT_TIERING storage class is designed to optimize storage costs
   * by automatically moving data to the most cost-effective storage access
   * tier, without performance impact or operational overhead.
   * INTELLIGENT_TIERING delivers automatic cost savings by moving data on a
   * granular object level between two access tiers, a frequent access tier and
   * a lower-cost infrequent access tier, when access patterns change. The
   * INTELLIGENT_TIERING storage class is ideal if you want to optimize storage
   * costs automatically for long-lived data when access patterns are unknown or
   * unpredictable.
   */
  INTELLIGENT_TIERING = "INTELLIGENT_TIERING",
}
