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
