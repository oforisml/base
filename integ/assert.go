package integ

import (
	"fmt"
	"regexp"
	"testing"

	"github.com/jmespath/go-jmespath"
	"github.com/stretchr/testify/require"
)

type Assertion struct {
	// Name           string
	Path           string
	ExpectedRegexp string
}

func Assert(t *testing.T, message interface{}, assertions []Assertion) {
	for _, a := range assertions {
		a := a // Capture range variable
		t.Run(a.Path, func(t *testing.T) {
			t.Parallel()
			require.NoError(t, assertRegexpAtPath(message, a.Path, a.ExpectedRegexp))
		})
	}
}

// ref https://github.com/aws/aws-cdk/blob/v2.161.1/packages/%40aws-cdk/integ-tests-alpha/lib/assertions/sdk.ts
func assertRegexpAtPath(message interface{}, path string, expectedRegexp string) error {
	value, err := jmespath.Search(path, message)
	if err != nil {
		return fmt.Errorf("error searching for path %s: %v", path, err)
	}

	var valueStr string
	switch v := value.(type) {
	case string:
		valueStr = v
	case float64, int, int64:
		valueStr = fmt.Sprintf("%v", v)
	case bool:
		valueStr = fmt.Sprintf("%t", v)
	default:
		return fmt.Errorf("unsupported type at path %s: %T", path, v)
	}

	re, err := regexp.Compile(expectedRegexp)
	if err != nil {
		return fmt.Errorf("invalid regexp %s: %v", expectedRegexp, err)
	}

	// Check if value matches regexp
	if !re.MatchString(valueStr) {
		return fmt.Errorf("value at path %s ('%s') does not match regexp '%s'", path, valueStr, expectedRegexp)
	}

	// Success
	return nil
}
