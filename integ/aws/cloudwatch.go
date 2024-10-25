package aws

import (
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatchevents"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	terratestaws "github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/retry"
	"github.com/gruntwork-io/terratest/modules/testing"
	"github.com/stretchr/testify/require"
)

// WaitForLogEvents waits for log events to appear in the given CloudWatch Log group in the given region
func WaitForLogEvents(
	t testing.TestingT,
	awsRegion string,
	logGroupName string,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) []string {
	events, err := WaitForLogEventsE(t, awsRegion, logGroupName, maxRetries, sleepBetweenRetries)
	require.NoError(t, err)
	return events
}

// WaitForLogEventsE waits for log events to appear in the given CloudWatch Log group in the given region
func WaitForLogEventsE(
	t testing.TestingT,
	awsRegion string,
	logGroupName string,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) ([]string, error) {
	var result []string

	description := fmt.Sprintf("Waiting for log events in log group %s", logGroupName)

	_, err := retry.DoWithRetryE(
		t,
		description,
		maxRetries,
		sleepBetweenRetries,
		func() (string, error) {
			messages, err := FilterLogEventsE(t, awsRegion, logGroupName)
			if err != nil {
				return "", err
			}

			if len(messages) > 0 {
				result = messages
				return "Log events found", nil
			} else {
				return "", fmt.Errorf("no log events found yet")
			}
		},
	)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetCloudWatchLogEntries returns the CloudWatch log messages in the given region for the given log stream and log group.
func FilterLogEvents(t testing.TestingT, awsRegion string, logGroupName string) []string {
	out, err := FilterLogEventsE(t, awsRegion, logGroupName)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// GetCloudWatchLogEntriesE returns the CloudWatch log messages in the given region for the given log stream and log group.
func FilterLogEventsE(t testing.TestingT, awsRegion string, logGroupName string) ([]string, error) {
	client, err := terratestaws.NewCloudWatchLogsClientE(t, awsRegion)
	if err != nil {
		return nil, err
	}

	output, err := client.FilterLogEvents(&cloudwatchlogs.FilterLogEventsInput{
		LogGroupName: aws.String(logGroupName),
	})

	if err != nil {
		return nil, err
	}

	entries := []string{}
	for _, event := range output.Events {
		entries = append(entries, *event.Message)
	}

	return entries, nil
}

// DescribeEventRule returns the details of the specified rule.
func DescribeEventRule(t testing.TestingT, awsRegion string, ruleName string) *CloudwatchEventsRuleInfo {
	out, err := DescribeEventRuleE(t, awsRegion, ruleName)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

type CloudwatchEventsRuleInfo struct {
	Name               string // The name of the rule.
	Description        string // The description of the rule.
	State              string // Specifies whether the rule is enabled or disabled.
	EventPattern       string // The event pattern.
	ScheduleExpression string // The scheduling expression. For example, "cron(0 20 * * ? *)", "rate(5 minutes)".
}

// DescribeEventRuleE returns the details of the specified rule.
func DescribeEventRuleE(t testing.TestingT, awsRegion string, ruleName string) (*CloudwatchEventsRuleInfo, error) {
	client, err := NewCloudWatchEventsClientE(t, awsRegion)
	if err != nil {
		return nil, err
	}

	output, err := client.DescribeRule(&cloudwatchevents.DescribeRuleInput{
		Name: aws.String(ruleName),
	})

	if err != nil {
		return nil, err
	}
	ruleInfo := &CloudwatchEventsRuleInfo{
		Name:               aws.StringValue(output.Name),
		Description:        aws.StringValue(output.Description),
		State:              aws.StringValue(output.State),
		EventPattern:       aws.StringValue(output.EventPattern),
		ScheduleExpression: aws.StringValue(output.ScheduleExpression),
	}
	return ruleInfo, nil
}

// NewCloudWatchEventsClient creates a new CloudWatch Events client.
func NewCloudWatchEventsClient(t testing.TestingT, region string) *cloudwatchevents.CloudWatchEvents {
	client, err := NewCloudWatchEventsClientE(t, region)
	if err != nil {
		t.Fatal(err)
	}
	return client
}

// NewCloudWatchEventsClientE creates a new CloudWatch Logs client.
func NewCloudWatchEventsClientE(t testing.TestingT, region string) (*cloudwatchevents.CloudWatchEvents, error) {
	sess, err := terratestaws.NewAuthenticatedSession(region)
	if err != nil {
		return nil, err
	}
	return cloudwatchevents.New(sess), nil
}
