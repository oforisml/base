package aws

import (
	"fmt"

	"github.com/aws/aws-sdk-go/service/acm"
)

// CloudFrontFunctionValidationFailed is an error that occurs if response validation fails.
type CloudFrontFunctionValidationFailed struct {
	FunctionName string
	Failures     *string
}

func (err CloudFrontFunctionValidationFailed) Error() string {
	if err.Failures == nil {
		return fmt.Sprintf("Validation failed for Function %s", err.FunctionName)
	}
	return fmt.Sprintf("Validation failed for Function %s.\nFailures:\n%s", err.FunctionName, *err.Failures)
}

// CertificateNotIssuedError is returned when the ACM Certificate status is not issued.
type CertificateNotIssuedError struct {
	certArn       string
	currentStatus string
}

func (err CertificateNotIssuedError) Error() string {
	return fmt.Sprintf(
		"Certificate %s not yet %s (current %s)",
		err.certArn,
		acm.CertificateStatusIssued,
		err.currentStatus,
	)
}

func NewCertificateNotIssuedError(certArn, currentStatus string) CertificateNotIssuedError {
	return CertificateNotIssuedError{certArn, currentStatus}
}

// IamRoleNotFoundError is returned when the IAM role is not found.
type IamRoleNotFoundError struct {
	roleName string
}

func (err IamRoleNotFoundError) Error() string {
	return fmt.Sprintf("IAM Role %s not found", err.roleName)
}

func NewIamRoleNotFoundError(roleName string) IamRoleNotFoundError {
	return IamRoleNotFoundError{roleName}
}

// IamManagedPolicyNotFoundError is returned when the IAM managed policy is not found.
type IamManagedPolicyNotFoundError struct {
	policyArn string
}

func (err IamManagedPolicyNotFoundError) Error() string {
	return fmt.Sprintf("IAM Managed Policy %s not found", err.policyArn)
}

func NewIamManagedPolicyNotFoundError(policyArn string) IamManagedPolicyNotFoundError {
	return IamManagedPolicyNotFoundError{policyArn}
}

// BucketNotificationNotEnabledError is returned when the S3 bucket notification is not enabled.
type BucketNotificationNotEnabledError struct {
	bucketName string
	region     string
}

func (err BucketNotificationNotEnabledError) Error() string {
	return fmt.Sprintf("Bucket %s in %s has no notification configuration", err.bucketName, err.region)
}

func NewBucketNotificationNotEnabledError(region, bucketName string) BucketNotificationNotEnabledError {
	return BucketNotificationNotEnabledError{bucketName, region}
}
