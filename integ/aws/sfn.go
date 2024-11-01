package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"

	"github.com/aws/aws-sdk-go-v2/service/sfn"
	"github.com/aws/aws-sdk-go-v2/service/sfn/types"
	"github.com/gruntwork-io/terratest/modules/logger"
	"github.com/gruntwork-io/terratest/modules/retry"
	"github.com/gruntwork-io/terratest/modules/testing"
	"github.com/stretchr/testify/require"
)

// StartSfnExecution starts a new execution of the specified state machine and returns the execution ARN. This will fail the
// test if there is an error.
func StartSfnExecution(t testing.TestingT, awsRegion string, stateMachineArn string, input interface{}) *string {
	executionArn, err := StartSfnExecutionE(t, awsRegion, stateMachineArn, input)
	require.NoError(t, err)
	return executionArn
}

// StartSfnExecutionE starts a new execution of the specified state machine and returns the execution ARN.
func StartSfnExecutionE(t testing.TestingT, awsRegion string, stateMachineArn string, input interface{}) (*string, error) {
	logger.Log(t, fmt.Sprintf("Starting execution for state machine %s with input %s", stateMachineArn, input))

	var inputStrPtr *string
	if input != nil {
		inputJson, err := json.Marshal(input)
		if err != nil {
			return nil, err
		}
		inputStr := string(inputJson)
		inputStrPtr = &inputStr
	}

	sfnClient, err := NewSfnclientE(t, awsRegion)
	if err != nil {
		return nil, err
	}

	res, err := sfnClient.StartExecution(context.TODO(), &sfn.StartExecutionInput{
		StateMachineArn: &stateMachineArn,
		Input:           inputStrPtr,
	})
	if err != nil {
		return nil, err
	}

	logger.Log(t, fmt.Sprintf("Execution started with ARN %s", *res.ExecutionArn))
	return res.ExecutionArn, nil
}

func DescribeSfnExecution(t testing.TestingT, awsRegion string, executionArn string) *sfn.DescribeExecutionOutput {
	res, err := DescribeSfnExecutionE(t, awsRegion, executionArn)
	require.NoError(t, err)
	return res
}

func DescribeSfnExecutionE(t testing.TestingT, awsRegion string, executionArn string) (*sfn.DescribeExecutionOutput, error) {
	sfnClient, err := NewSfnclientE(t, awsRegion)
	if err != nil {
		return nil, err
	}

	return sfnClient.DescribeExecution(context.TODO(), &sfn.DescribeExecutionInput{
		ExecutionArn: &executionArn,
	})
}

// ExecutionOutput contains the result of the SateMachine Execution.
type SfnExecutionOutput struct {
	// The current status of the execution.
	Status types.ExecutionStatus
	// The cause string if the state machine execution failed.
	Cause string
	// The error string if the state machine execution failed.
	Error string
	// The JSON output data of the execution. Length constraints apply to the payload
	// size, and are expressed as bytes in UTF-8 encoding.
	//
	// This field is set only if the execution succeeds. If the execution fails, this
	// field is the string Zero value ("").
	Output string
}

// WaitForSfnExecutionStatus waits for the specified execution to reach the desired status.
// This will fail the test if there is an error.
//
// Executions of an EXPRESS state machine aren't supported by DescribeExecution
// unless a Map Run dispatched them.
func WaitForSfnExecutionStatus(
	t testing.TestingT,
	awsRegion string,
	executionArn string,
	status types.ExecutionStatus,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) *SfnExecutionOutput {
	res, err := WaitForSfnExecutionE(t, awsRegion, executionArn, status, maxRetries, sleepBetweenRetries)
	require.NoError(t, err)
	return res
}

// WaitForSfnExecutionE waits for the specified execution to reach the desired status. this will throw error on timeout or non-retryable Errors.
func WaitForSfnExecutionE(
	t testing.TestingT,
	awsRegion string,
	executionArn string,
	status types.ExecutionStatus,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) (*SfnExecutionOutput, error) {

	retryableErrors := map[string]string{
		// "ExecutionDoesNotExist":       "ExecutionDoesNotExist",
		"bad status: RUNNING":         "bad status: RUNNING",
		"bad status: PENDING_REDRIVE": "bad status: PENDING_REDRIVE",
	}

	description := fmt.Sprintf("Waiting for %s to reach status %s", executionArn, status)

	result := &SfnExecutionOutput{}
	_, err := retry.DoWithRetryableErrorsE(
		t,
		description,
		retryableErrors,
		maxRetries,
		sleepBetweenRetries,
		func() (string, error) {
			resp, err := DescribeSfnExecutionE(t, awsRegion, executionArn)
			if err != nil {
				return "", err
			}

			result.Status = resp.Status
			result.Cause = aws.ToString(resp.Cause)
			result.Error = aws.ToString(resp.Error)
			result.Output = aws.ToString(resp.Output)

			if resp.Status == status {
				return "", nil
			} else {
				return "", fmt.Errorf("bad status: %s", resp.Status)
			}
		},
	)

	if err != nil {
		if actualErr, ok := err.(retry.FatalError); ok {
			return result, actualErr.Underlying
		}
		return result, fmt.Errorf("unexpected error: %v", err)
	}

	return result, nil
}

// NewSfnclient returns a client for StepFunctions. This will fail the test and
// stop execution if there is an error.
func NewSfnclient(t testing.TestingT, awsRegion string) *sfn.Client {
	sess, err := NewSfnclientE(t, awsRegion)
	require.NoError(t, err)
	return sess
}

// NewSfnclientE returns a client for StepFunctions.
func NewSfnclientE(t testing.TestingT, awsRegion string) (*sfn.Client, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(awsRegion))
	if err != nil {
		return nil, err
	}
	return sfn.NewFromConfig(cfg), nil
}
