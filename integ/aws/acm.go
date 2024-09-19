package aws

import (
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go/service/acm"
	"github.com/stretchr/testify/require"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/logger"
	"github.com/gruntwork-io/terratest/modules/retry"
	"github.com/gruntwork-io/terratest/modules/testing"
)

// ref: https://github.com/gruntwork-io/terratest/blob/v0.47.1/modules/aws/acm.go

// Get Certificate Status
func GetAcmCertificateStatus(t testing.TestingT, awsRegion string, certArn string) string {
	status, err := GetAcmCertificateStatusE(t, awsRegion, certArn)
	if err != nil {
		t.Fatal(err)
	}
	return status
}

// GetAcmCertificateStatusE gets the ACM certificate status for the given certificate ARN in the given region.
func GetAcmCertificateStatusE(t testing.TestingT, awsRegion string, certArn string) (string, error) {
	acmClient, err := aws.NewAcmClientE(t, awsRegion)
	if err != nil {
		return "", err
	}

	result, err := acmClient.DescribeCertificate(&acm.DescribeCertificateInput{
		CertificateArn: &certArn,
	})
	if err != nil {
		return "", err
	}

	return *result.Certificate.Status, nil
}

// WaitForCertificateIssued waits for the certificate to be issued
func WaitForCertificateIssued(
	t testing.TestingT,
	certArn string,
	region string,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) {
	err := WaitForCertificateIssuedE(t, certArn, region, maxRetries, sleepBetweenRetries)
	require.NoError(t, err)
}

// WaitForCertificateIssuedE waits for the ACM Certificate to be issued
func WaitForCertificateIssuedE(
	t testing.TestingT,
	certArn string,
	region string,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) error {
	msg, err := retry.DoWithRetryE(
		t,
		fmt.Sprintf("Waiting for Certificate %s to be ISSUED.", certArn),
		maxRetries,
		sleepBetweenRetries,
		func() (string, error) {
			certStatus, err := GetAcmCertificateStatusE(t, region, certArn)
			if err != nil {
				return "", err
			}
			if certStatus != acm.CertificateStatusIssued {
				return "", NewCertificateNotIssuedError(certArn, certStatus)
			}
			return fmt.Sprintf("Certificate %s is now at desired status %s", certArn, acm.CertificateStatusIssued), nil
		},
	)
	logger.Log(t, msg)
	return err
}
