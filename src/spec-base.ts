import {
  TerraformStack,
  TerraformElement,
  HttpBackendConfig,
  HttpBackend,
  Tokenization,
  DefaultTokenResolver, // https://github.com/hashicorp/terraform-cdk/blob/v0.20.9/packages/cdktf/lib/tokens/resolvable.ts#L176
  StringConcat, // https://github.com/hashicorp/terraform-cdk/blob/v0.20.9/packages/cdktf/lib/tokens/resolvable.ts#L156
  Aspects,
  IResolveContext,
  Lazy,
} from "cdktf";
import { Construct, IConstruct, Node } from "constructs";
import {
  makeUniqueResourceName,
  makeUniqueResourceNamePrefix,
  TerraformDependencyAspect,
} from "./private";

const TOKEN_RESOLVER = new DefaultTokenResolver(new StringConcat());

const SPEC_SYMBOL = Symbol.for("@envtio/base/lib.Spec");

// https://github.com/aws/aws-cdk/blob/v2.156.0/packages/aws-cdk-lib/core/lib/names.ts

/**
 * Options for creating a unique resource name_prefix.
 */
export interface UniqueResourceNamePrefixOptions
  extends UniqueResourceNameOptions {
  /**
   * Length of the random generated suffix added by some Terraform providers.
   *
   * NOTE: https://github.com/hashicorp/terraform-provider-aws/issues/625
   * @default - 26
   */
  readonly suffixLength?: number;
}

/**
 * Options for creating a unique resource name.
 */
export interface UniqueResourceNameOptions {
  /**
   * The maximum length of the unique resource name.
   *
   * @default - 256
   */
  readonly maxLength?: number;

  /**
   * The separator used between the path components.
   *
   * @default - none
   */
  readonly separator?: string;

  /**
   * Non-alphanumeric characters allowed in the unique resource name.
   *
   * @default - none
   */
  readonly allowedSpecialCharacters?: string;

  /**
   * Prefix to be added into the stack name
   *
   * @default - none
   */
  readonly prefix?: string;

  /**
   * Whether to convert the resource name to lowercase.
   *
   * @default - false
   */
  readonly lowerCase?: boolean;
}

export interface SpecBaseProps {
  /**
   * Beacon UUID within the grid.
   *
   * UUID is generated by the CLI and ensures resource Identity
   * is decoupled from resource tagging for consistency.
   *
   * UUID may be user provided for imported resources
   */
  readonly gridUUID: string;

  /**
   * The environment name passed in from the CLI
   */
  readonly environmentName: string;

  /**
   * Stores the state using a simple REST client.
   *
   * State will be fetched via GET, updated via POST, and purged with DELETE.
   * The method used for updating is configurable.
   *
   * This backend optionally supports state locking.
   * When locking support is enabled it will use LOCK and UNLOCK requests providing the lock info in the body.
   * The endpoint should return a 423: Locked or 409: Conflict with the holding lock info when
   * it's already taken, 200: OK for success. Any other status will be considered an error.
   * The ID of the holding lock info will be added as a query parameter to state updates requests.
   *
   * Read more about this backend in the Terraform docs:
   * https://developer.hashicorp.com/terraform/language/settings/backends/http
   */
  readonly gridBackendConfig?: HttpBackendConfig;
}

export interface ISpec extends IConstruct {
  /**
   * Environment Name passed in from the CLI
   */
  readonly environmentName: string;
  readonly gridUUID: string;
  readonly gridBackend?: HttpBackend;
  resolve(obj: any, preparing?: boolean): any;
  uniqueResourceName(
    tfElement: TerraformElement | Node,
    options: UniqueResourceNameOptions,
  ): string;
  uniqueResourceNamePrefix(
    tfElement: TerraformElement | Node,
    options: UniqueResourceNamePrefixOptions,
  ): string;
  // toJsonString(obj: any, space?: number): string;
}

/**
 * Base class for all E.T. Specs
 *
 * Provides a reference to the grid UUID and environment name
 */
export abstract class SpecBase extends TerraformStack implements ISpec {
  /**
   * Return whether the given object is a Stack.
   *
   * attribute detection since as 'instanceof' potentially fails across Library releases.
   */
  public static isSpec(x: any): x is ISpec {
    return x !== null && typeof x === "object" && SPEC_SYMBOL in x;
  }

  /**
   * Looks up the first stack scope in which `construct` is defined. Fails if there is no stack up the tree or the stack is not an ISpec.
   * @param construct The construct to start the search from.
   */
  public static ofBeacon(construct: IConstruct): ISpec {
    const s = TerraformStack.of(construct);
    if (SpecBase.isSpec(s)) {
      return s;
    }
    throw new Error(
      `Resource '${construct.constructor?.name}' at '${construct.node.path}' should be created in the scope of E.T. ISpec, but no ISpec found`,
    );
  }

  /**
   * Returns a unique identifier for a construct based on its path within
   * a TerraformStack. see uniqueResourceName, but with no separator, maximum length 255 and allows
   *  "_" and "-" on top of alphanumerical characters.
   *
   * @param construct The construct
   * @returns a unique resource name based on the construct path
   */
  public static uniqueId(construct: IConstruct | Node) {
    return SpecBase.uniqueResourceName(construct, {
      maxLength: 255,
      // avoid https://github.com/aws/aws-cdk/issues/6421
      allowedSpecialCharacters: "_-",
    });
  }

  /**
   * Returns a unique identifier for a construct based
   * on its path within a TerraformStack.
   *
   * Throws if no TerraformStack is found within it's construct path.
   *
   * This function finds the id of the parent stack (non-nested)
   * to the construct, and the ids of the components in the construct path.
   *
   * The user can define allowed special characters, a separator between the elements,
   * and the maximum length of the resource name. The name includes a human readable portion rendered
   * from the path components, with or without user defined separators, and a hash suffix.
   * If the resource name is longer than the maximum length, it is trimmed in the middle.
   *
   * @param construct The construct
   * @param options Options for defining the unique resource name
   * @returns a unique resource name based on the construct path
   */
  private static uniqueResourceName(
    construct: IConstruct | Node,
    options: UniqueResourceNameOptions,
  ) {
    const node = Construct.isConstruct(construct) ? construct.node : construct;
    const stack = node.scopes
      .reverse()
      .find((component) => TerraformStack.isStack(component));

    if (!stack) {
      throw new Error(
        "Unable to calculate a unique id without a stack in the construct path",
      );
    }

    const specIndex = node.scopes.indexOf(stack);
    const componentsPath = node.scopes
      .slice(specIndex)
      .map((component) => component.node.id);

    return makeUniqueResourceName(componentsPath, options);
  }

  /**
   * Spec unique grid identifier
   */
  public readonly gridUUID: string;

  /**
   * Environment Name passed in from the CLI
   */
  public readonly environmentName: string;

  /**
   * The grid provided backend for state storage
   */
  public readonly gridBackend?: HttpBackend;

  constructor(scope: Construct, id: string, props: SpecBaseProps) {
    super(scope, id);
    this.gridUUID = props.gridUUID;
    this.environmentName = props.environmentName;
    Object.defineProperty(this, SPEC_SYMBOL, { value: true });
    if (props.gridBackendConfig) {
      this.gridBackend = new HttpBackend(this, props.gridBackendConfig);
    }

    // Map construct tree dependencies to ITerraformDependables
    // ref: https://github.com/hashicorp/terraform-cdk/issues/2727#issuecomment-1473321075
    Aspects.of(this).add(new TerraformDependencyAspect());
    // Aspects are invoked in synth after stack has been prepared
    // this should ensure any resources added during `prepareStack()` are included in the dependency tree
    // ref: https://github.com/hashicorp/terraform-cdk/blob/v0.20.9/packages/cdktf/lib/synthesize/synthesizer.ts#L121
  }

  /**
   * Returns a Terraform-compatible unique identifier for a Terraform Element based
   * on its path. This function finds the stackName of the parent stack (non-nested)
   * to the construct, and the ids of the components in the construct path.
   *
   * The user can define allowed special characters, a separator between the elements,
   * and the maximum length of the resource name. The name includes a human readable portion rendered
   * from the path components, with or without user defined separators, and a hash suffix.
   * If the resource name is longer than the maximum length, it is trimmed in the middle.
   *
   * @param tfElement The construct
   * @param options Options for defining the unique resource name
   * @returns a unique resource name based on the construct path
   */
  public uniqueResourceName(
    tfElement: TerraformElement | Node,
    options: UniqueResourceNameOptions,
  ): string {
    const node = Construct.isConstruct(tfElement) ? tfElement.node : tfElement;
    const stack = TerraformElement.isTerraformElement(tfElement)
      ? tfElement.cdktfStack
      : this;
    const specIndex = node.scopes.indexOf(stack);
    const componentsPath = node.scopes
      .slice(specIndex)
      .map((component) => component.node.id);

    return makeUniqueResourceName(componentsPath, options);
  }

  /**
   * Returns a Terraform-compatible unique identifier for a Terraform Element based
   * on its path. This function finds the stackName of the parent stack (non-nested)
   * to the construct, and the ids of the components in the construct path.
   *
   * The user can define allowed special characters, a separator between the elements,
   * and the maximum length of the resource name. The name includes a human readable portion rendered
   * from the path components, with or without user defined separators, and depends on the
   * resource provider to generate the random suffix.
   *
   * If the resource name is longer than the maximum length - suffixLength, it is trimmed in the middle.
   *
   * @param tfElement The construct
   * @param options Options for defining the unique resource name
   * @returns a unique resource name based on the construct path
   */
  public uniqueResourceNamePrefix(
    tfElement: TerraformElement | Node,
    options: UniqueResourceNamePrefixOptions,
  ): string {
    const node = Construct.isConstruct(tfElement) ? tfElement.node : tfElement;
    const stack = TerraformElement.isTerraformElement(tfElement)
      ? tfElement.cdktfStack
      : this;
    const specIndex = node.scopes.indexOf(stack);
    const componentsPath = node.scopes
      .slice(specIndex)
      .map((component) => component.node.id);

    return makeUniqueResourceNamePrefix(componentsPath, options);
  }

  /** Resolve IResolvable in scope of this AwsSpec */
  public resolve(obj: any, preparing = false): any {
    return Tokenization.resolve(obj, {
      scope: this,
      preparing,
      resolver: TOKEN_RESOLVER,
    });
  }

  /**
   * Convert an object, potentially containing tokens, to a JSON string
   */
  public toJsonString(obj: any, space?: number): string {
    return Lazy.stringValue({
      produce: (ctx: IResolveContext) => {
        // First resolve Token objects with string concat... then JSON.stringify the resulting object
        //
        // unlike cloudformation, Terraform does not need an intrinsic wrapper?
        // https://github.com/aws/aws-cdk/blob/8dca5079e1893122057f9e2c54c0da0ba644926e/packages/%40aws-cdk/core/lib/private/cloudformation-lang.ts#L73
        // intrinsic wrapper without cross stack ref
        // https://github.com/aws/aws-cdk/blob/14e4bc91ed5f0f8cb7c8ac9ee8a6de4da54e6585/packages/%40aws-cdk/core/lib/private/cloudformation-lang.ts#L50
        const resolved = Tokenization.resolve(obj, {
          preparing: ctx.preparing,
          scope: ctx.scope,
          resolver: TOKEN_RESOLVER,
        });
        return JSON.stringify(resolved, undefined, space);
      },
    });
  }
}
