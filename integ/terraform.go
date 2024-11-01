package integ

import (
	"encoding/json"
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/jmespath/go-jmespath"

	"github.com/stretchr/testify/require"
)

// TerraformOutputJMES calls terraform output, searches values using JMESPath and converts to the desired type. This fails the test on any errors
func TerraformOutputJMES[T any](t *testing.T, terraformOptions *terraform.Options, query string) T {
	value := TerraformOutputJMESAny(t, terraformOptions, query)
	// Go type assertions fail on this, so we use JSON marshalling
	// result, ok := value.(T)
	// require.True(t, ok, "expected %T, got %T", result, value)
	var result T
	jsonData, err := json.Marshal(value)
	require.NoError(t, err, "Failed to marshal value to JSON")

	err = json.Unmarshal(jsonData, &result)
	require.NoError(t, err, "Failed to unmarshal JSON to type %T", result)

	return result
}

// TerraformOutputJMESAny calls terraform output and searches values using JMESPath. This fails the test on any errors
func TerraformOutputJMESAny(t *testing.T, terraformOptions *terraform.Options, query string) interface{} {
	result, err := TerraformOutputJMESAnyE(t, terraformOptions, query)
	require.NoError(t, err)
	return result
}

// TerraformOutputJMESAnyE calls terraform output and searches values using JMESPath.
func TerraformOutputJMESAnyE(t *testing.T, terraformOptions *terraform.Options, query string) (interface{}, error) {
	p, err := jmespath.Compile(query)
	if err != nil {
		return nil, err
	}
	outputMap, err := terraform.OutputForKeysE(t, terraformOptions, nil)
	if err != nil {
		return nil, err
	}
	value, err := p.Search(outputMap)
	if err != nil {
		return nil, err
	}
	return value, nil
}
