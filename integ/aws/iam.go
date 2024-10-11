package aws

import (
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go/service/iam"
	terratestaws "github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/testing"
	"github.com/stretchr/testify/require"
)

// Get IAM Role with all inline policies and attached Policy ARNs, fail on error
func GetIamRole(t testing.TestingT, awsRegion string, roleName string) *Role {
	result, err := GetIamRoleE(t, awsRegion, roleName)
	require.NoError(t, err)
	return result
}

// Get IAM Role with all inline policies and attached Policy ARNs, return result or error
func GetIamRoleE(t testing.TestingT, awsRegion string, roleName string) (*Role, error) {
	svc := terratestaws.NewIamClient(t, awsRegion)
	result, err := svc.GetRole(&iam.GetRoleInput{
		RoleName: &roleName,
	})
	if err != nil {
		return nil, err
	}
	if result.Role == nil {
		return nil, NewIamRoleNotFoundError(roleName)
	}
	inlinePolicies, err := getRoleInlinePolicies(svc, roleName)
	if err != nil {
		return nil, err
	}
	attachedPolicyArns, err := getRoleAttachedPolicyArns(svc, roleName)
	if err != nil {
		return nil, err
	}
	tags := make([]iam.Tag, len(result.Role.Tags))
	for i, tag := range result.Role.Tags {
		tags[i] = *tag
	}
	// Policies returned by this operation are URL-encoded compliant with RFC 3986 (https://tools.ietf.org/html/rfc3986).
	// You can use a URL decoding method to convert the policy back to plain JSON text.
	assumeRolePolicyDocument, err := URLDecode(*result.Role.AssumeRolePolicyDocument)
	if err != nil {
		return nil, err
	}
	description := ""
	if result.Role.Description != nil {
		description = *result.Role.Description
	}
	permissionBoundary := AttachedPermissionsBoundary{}
	if result.Role.PermissionsBoundary != nil {
		permissionBoundary = AttachedPermissionsBoundary{
			PermissionsBoundaryArn:  *result.Role.PermissionsBoundary.PermissionsBoundaryArn,
			PermissionsBoundaryType: *result.Role.PermissionsBoundary.PermissionsBoundaryType,
		}
	}
	role := Role{
		Arn:                      *result.Role.Arn,
		AssumeRolePolicyDocument: assumeRolePolicyDocument,
		CreateDate:               *result.Role.CreateDate,
		Description:              description,
		MaxSessionDuration:       *result.Role.MaxSessionDuration,
		Path:                     *result.Role.Path,
		PermissionsBoundary:      permissionBoundary,
		RoleId:                   *result.Role.RoleId,
		RoleLastUsed:             *result.Role.RoleLastUsed,
		RoleName:                 *result.Role.RoleName,
		Tags:                     tags,
		InlinePolicies:           inlinePolicies,
		AttachedPolicyArns:       attachedPolicyArns,
	}
	return &role, nil
}

// Get IAM Managed Policy, fail on error
func GetIamManagedPolicy(t testing.TestingT, awsRegion string, policyArn string) *ManagedPolicy {
	result, err := GetIamManagedPolicyE(t, awsRegion, policyArn)
	require.NoError(t, err)
	return result
}

// Get IAM Managed Policy, return result or error
func GetIamManagedPolicyE(t testing.TestingT, awsRegion string, policyArn string) (*ManagedPolicy, error) {
	svc := terratestaws.NewIamClient(t, awsRegion)
	input := &iam.GetPolicyInput{
		PolicyArn: &policyArn,
	}
	p, err := svc.GetPolicy(input)
	if err != nil {
		return nil, err
	}
	if p.Policy == nil {
		return nil, fmt.Errorf("IAM Managed Policy %s missing from GetPolicy response", policyArn)
	}
	tags := make([]iam.Tag, len(p.Policy.Tags))
	for i, tag := range p.Policy.Tags {
		tags[i] = *tag
	}
	description := ""
	if p.Policy.Description != nil {
		description = *p.Policy.Description
	}
	managedPolicy := ManagedPolicy{
		Arn:                           *p.Policy.Arn,
		AttachmentCount:               *p.Policy.AttachmentCount,
		CreateDate:                    *p.Policy.CreateDate,
		DefaultVersionId:              *p.Policy.DefaultVersionId,
		Description:                   description,
		IsAttachable:                  *p.Policy.IsAttachable,
		Path:                          *p.Policy.Path,
		PermissionsBoundaryUsageCount: *p.Policy.PermissionsBoundaryUsageCount,
		PolicyId:                      *p.Policy.PolicyId,
		PolicyName:                    *p.Policy.PolicyName,
		Tags:                          tags,
		UpdateDate:                    *p.Policy.UpdateDate,
	}
	if p.Policy.DefaultVersionId == nil {
		return nil, fmt.Errorf("IAM Managed Policy %s default Version Id missing from GetPolicy response", policyArn)
	}
	pv, err := svc.GetPolicyVersion(&iam.GetPolicyVersionInput{
		PolicyArn: &policyArn,
		VersionId: p.Policy.DefaultVersionId,
	})
	if err != nil {
		return nil, err
	}
	if pv.PolicyVersion == nil {
		return nil, fmt.Errorf("IAM Managed Policy %s missing from GetPolicyVersion response", policyArn)
	}
	// Policies returned by this operation are URL-encoded compliant with RFC 3986 (https://tools.ietf.org/html/rfc3986).
	// You can use a URL decoding method to convert the policy back to plain JSON text.
	managedPolicyDocument, err := URLDecode(*pv.PolicyVersion.Document)
	if err != nil {
		return nil, err
	}
	managedPolicy.PolicyDocument = managedPolicyDocument
	return &managedPolicy, nil
}

func getRoleInlinePolicies(svc *iam.IAM, roleName string) ([]InlinePolicy, error) {
	inlinePolicies := make([]InlinePolicy, 0)
	p := &iam.ListRolePoliciesInput{
		RoleName: &roleName,
	}
	// TODO use multierr?
	err := svc.ListRolePoliciesPages(p, func(page *iam.ListRolePoliciesOutput, _last bool) bool {
		for _, value := range page.PolicyNames {
			policy, err := svc.GetRolePolicy(&iam.GetRolePolicyInput{
				PolicyName: value,
				RoleName:   &roleName,
			})
			if err != nil {
				return false
			}
			// Policies returned by this operation are URL-encoded compliant with RFC 3986 (https://tools.ietf.org/html/rfc3986).
			// You can use a URL decoding method to convert the policy back to plain JSON text.
			inlinePolicyDocument, err := URLDecode(*policy.PolicyDocument)
			if err != nil {
				return false
			}
			inlinePolicies = append(inlinePolicies, InlinePolicy{
				PolicyName:     *value,
				PolicyDocument: inlinePolicyDocument,
			})
		}
		return true
	})
	if err != nil {
		return nil, err
	}
	return inlinePolicies, nil
}

func getRoleAttachedPolicyArns(svc *iam.IAM, roleName string) ([]string, error) {
	attachedPolicyArns := make([]string, 0)
	err := svc.ListAttachedRolePoliciesPages(&iam.ListAttachedRolePoliciesInput{
		RoleName: &roleName,
	}, func(page *iam.ListAttachedRolePoliciesOutput, _last bool) bool {
		for _, value := range page.AttachedPolicies {
			attachedPolicyArns = append(attachedPolicyArns, *value.PolicyArn)
		}
		return true
	})
	if err != nil {
		return nil, err
	}
	return attachedPolicyArns, nil
}

// IAM Role struct with Inline Policies and Attached Policy ARNs
type Role struct {
	Arn                      string                      `json:"arn"`                      // The Amazon Resource Name (ARN) specifying the role.
	AssumeRolePolicyDocument string                      `json:"assumeRolePolicyDocument"` // The policy that grants an entity permission to assume the role.
	CreateDate               time.Time                   `json:"createDate"`               // The date and time, in ISO 8601 date-time format, when the role was created.
	Description              string                      `json:"description"`              // A description of the role that you provide.
	MaxSessionDuration       int64                       `json:"maxSessionDuration"`       // The maximum session duration (in seconds) for the specified role.
	Path                     string                      `json:"path"`                     // The path to the role.
	PermissionsBoundary      AttachedPermissionsBoundary `json:"permissionsBoundary"`      // The ARN of the policy used to set the permissions boundary for the role.
	RoleId                   string                      `json:"roleId"`                   // The stable and unique string identifying the role.
	RoleLastUsed             iam.RoleLastUsed            `json:"roleLastUsed"`             // Contains information about the last time that an IAM role was used.
	RoleName                 string                      `json:"roleName"`                 // The friendly name that identifies the role.
	InlinePolicies           []InlinePolicy              `json:"inlinePolicies"`           // The inline policies of the IAM role.
	AttachedPolicyArns       []string                    `json:"attachedPolicyArns"`       // The Amazon Resource Names (ARNs) of the managed policies attached to the role.
	Tags                     []iam.Tag                   `json:"tags"`                     // A list of tags that are attached to the role.
}

// Contains decoded inline document and policy name
type InlinePolicy struct {
	PolicyDocument string `json:"policyDocument"` // The policy document.
	PolicyName     string `json:"policyName"`     // The name of the policy.
}

// Contains information about a managed policy.
type ManagedPolicy struct {
	Arn                           string    `json:"arn"`                           // The Amazon Resource Name (ARN).
	PolicyDocument                string    `json:"policyDocument"`                // The policy document.
	AttachmentCount               int64     `json:"attachmentCount"`               // The number of entities (users, groups, and roles) that the policy is attached to.
	CreateDate                    time.Time `json:"createDate"`                    // The date and time, in ISO 8601 date-time format, when the policy was created.
	DefaultVersionId              string    `json:"defaultVersionId"`              // The identifier for the version of the policy that is set as the default version.
	Description                   string    `json:"description"`                   // A friendly description of the policy.
	IsAttachable                  bool      `json:"isAttachable"`                  // Specifies whether the policy can be attached to an IAM user, group, or role.
	Path                          string    `json:"path"`                          // The path to the policy.
	PermissionsBoundaryUsageCount int64     `json:"permissionsBoundaryUsageCount"` // The number of entities (users and roles) for which the policy is used to set the permissions boundary.
	PolicyId                      string    `json:"policyId"`                      // The stable and unique string identifying the policy.
	PolicyName                    string    `json:"policyName"`                    // The friendly name (not ARN) identifying the policy.
	Tags                          []iam.Tag `json:"tags"`                          // A list of tags that are attached to the instance profile.
	UpdateDate                    time.Time `json:"updateDate"`                    // The date and time, in ISO 8601 date-time format, when the policy was last updated.
}

type AttachedPermissionsBoundary struct {
	PermissionsBoundaryArn  string `json:"permissionsBoundaryArn"`  // The ARN of the policy used to set the permissions boundary for the user or role.
	PermissionsBoundaryType string `json:"permissionsBoundaryType"` // The permissions boundary usage type that indicates what type of IAM resource is used as the permissions boundary for an entity. This data type can only have a value of Policy.
}
