import { Statement } from "iam-floyd";

/**
 * Utility class for generating IAM policies from iam-floyd PolicyStatements
 *
 * @deprecated Use `iam.PolicyDocument` instead.
 */
export class FloydPolicy {
  public static document(...statements: Statement.All[]): string {
    return JSON.stringify({
      Version: "2012-10-17",
      Statement: statements,
    });
  }

  private readonly statements: Statement.All[];
  constructor(...statements: Statement.All[]) {
    this.statements = statements;
  }
  /**
   * Whether the policy document contains any statements.
   */
  public get isEmpty(): boolean {
    return this.statements.length === 0;
  }

  /**
   * The number of statements already added to this policy.
   * Can be used, for example, to generate unique "sid"s within the policy.
   */
  public get statementCount(): number {
    return this.statements.length;
  }

  /**
   * Adds a statement to the policy document.
   *
   * @param statement the statement to add.
   */
  public addStatements(...statement: Statement.All[]) {
    this.statements.push(...statement);
  }
  toString() {
    return FloydPolicy.document(...this.statements);
  }
  /**
   * Validate that all policy statements in the policy document satisfies the
   * requirements for any policy.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html#access_policies-json
   *
   * @returns An array of validation error messages, or an empty array if the document is valid.
   */
  public validateForAnyPolicy(): string[] {
    const errors = new Array<string>();
    for (const statement of this.statements) {
      if (!statement.hasActions()) {
        errors.push(
          `'A PolicyStatement must specify at least one \'action\' or \'notAction\'.`,
        );
      }
    }
    return errors;
  }

  /**
   * Validate that all policy statements in the policy document satisfies the
   * requirements for a resource-based policy.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html#access_policies-json
   *
   * @returns An array of validation error messages, or an empty array if the document is valid.
   */
  public validateForResourcePolicy(): string[] {
    const errors = this.validateForAnyPolicy();
    for (const statement of this.statements) {
      if (!statement.hasPrincipals()) {
        errors.push(
          "A PolicyStatement used in a resource-based policy must specify at least one IAM principal.",
        );
      }
    }
    return errors;
  }

  /**
   * Validate that all policy statements in the policy document satisfies the
   * requirements for an identity-based policy.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html#access_policies-json
   *
   * @returns An array of validation error messages, or an empty array if the document is valid.
   */
  public validateForIdentityPolicy(): string[] {
    const errors = this.validateForAnyPolicy();
    for (const statement of this.statements) {
      if (statement.hasPrincipals()) {
        errors.push(
          "A PolicyStatement used in an identity-based policy cannot specify any IAM principals.",
        );
      }
      if (!statement.hasResources()) {
        errors.push(
          "A PolicyStatement used in an identity-based policy must specify at least one resource.",
        );
      }
    }
    return errors;
  }
}
