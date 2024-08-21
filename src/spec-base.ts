import { TerraformStack, HttpBackendConfig, HttpBackend } from "cdktf";
import { Construct, IConstruct } from "constructs";

const SPEC_SYMBOL = Symbol.for("@envtio/base/lib/Spec");

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

export interface ISpec {
  /**
   * Environment Name passed in from the CLI
   */
  readonly environmentName: string;
  readonly gridUUID: string;
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
      `Resource '${construct.constructor?.name}' at '${construct.node.path}' should be created in the scope of a ISpec, but no ISpec found`,
    );
  }

  /**
   * Spec unique grid identifier
   */
  public readonly gridUUID: string;

  /**
   * Environment Name passed in from the CLI
   */
  public readonly environmentName: string;

  public readonly gridBackend?: HttpBackend;

  constructor(scope: Construct, id: string, props: SpecBaseProps) {
    super(scope, id);
    this.gridUUID = props.gridUUID;
    this.environmentName = props.environmentName;
    Object.defineProperty(this, SPEC_SYMBOL, { value: true });
    if (props.gridBackendConfig) {
      this.gridBackend = new HttpBackend(this, props.gridBackendConfig);
    }
  }
}