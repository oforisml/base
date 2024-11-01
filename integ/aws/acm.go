package aws

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/acm"
	"github.com/aws/aws-sdk-go-v2/service/acm/types"
	"github.com/stretchr/testify/require"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/logger"
	"github.com/gruntwork-io/terratest/modules/retry"
	"github.com/gruntwork-io/terratest/modules/testing"
)

// ref: https://github.com/gruntwork-io/terratest/blob/v0.47.1/modules/aws/acm.go

// Get Certificate Status
func GetAcmCertificateStatus(t testing.TestingT, awsRegion string, certArn string) types.CertificateStatus {
	status, err := GetAcmCertificateStatusE(t, awsRegion, certArn)
	require.NoError(t, err)
	return status
}

// GetAcmCertificateStatusE gets the ACM certificate status for the given certificate ARN in the given region.
func GetAcmCertificateStatusE(t testing.TestingT, awsRegion string, certArn string) (types.CertificateStatus, error) {
	acmClient, err := aws.NewAcmClientE(t, awsRegion)
	if err != nil {
		return "", err
	}

	result, err := acmClient.DescribeCertificate(context.Background(), &acm.DescribeCertificateInput{
		CertificateArn: &certArn,
	})
	if err != nil {
		return "", err
	}

	return result.Certificate.Status, nil
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
		fmt.Sprintf("Waiting for Certificate %s to be %s.", certArn, types.CertificateStatusIssued),
		maxRetries,
		sleepBetweenRetries,
		func() (string, error) {
			certStatus, err := GetAcmCertificateStatusE(t, region, certArn)
			if err != nil {
				return "", err
			}
			if certStatus != types.CertificateStatusIssued {
				return "", NewCertificateNotIssuedError(certArn, certStatus)
			}
			return fmt.Sprintf("Certificate %s is now at desired status %s", certArn, types.CertificateStatusIssued), nil
		},
	)
	logger.Log(t, msg)
	return err
}
