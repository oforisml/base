package integ

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAssert_Success(t *testing.T) {
	Assert(t, testObject, []Assertion{
		{
			Path:           "request.uri",
			Exists:         true,
			ExpectedRegexp: strPtr("index.html$"),
		},
		{
			Path:           "status",
			ExpectedRegexp: strPtr(`^\d+$`),
		},
		// // lower is not supported by go-jmespath
		// {
		// 	Path:           "request.headers.*[lower(@) == 'host']",
		// 	ExpectedRegexp: strPtr("(?i)www\\.example\\.com"),
		// },
		{
			Path:           "request.querystring.test.value",
			ExpectedRegexp: strPtr("true"),
		},
	})
}

func TestAssert_Failure(t *testing.T) {
	err := AssertE(testObject, []Assertion{
		{
			Path:           "request.uri",
			ExpectedRegexp: strPtr("^index.html"),
		},
		{
			Path:           "status",
			ExpectedRegexp: strPtr(`^3..$`),
		},
		{
			Path:   "request.querystring.foo",
			Exists: true,
		},
	})
	assert.Error(t, err, "Expected error due to failed assertions")
}

func TestAssert_ShouldExistFalse(t *testing.T) {
	Assert(t, testObject, []Assertion{
		{
			Path:   "request.headers.authorization",
			Exists: false,
		},
	})
}

func TestAssert_NoExpectedRegexp(t *testing.T) {
	Assert(t, testObject, []Assertion{
		{
			Path:   "request.querystring",
			Exists: true,
		},
		{
			Path:   "request.uri",
			Exists: true,
		},
	})
}

func TestAssert_AdvancedJMESPath_ArrayValues(t *testing.T) {
	Assert(t, testObject, []Assertion{
		{
			// Check that 'val1' is among the 'multiValue[*].value'
			Path:           "request.querystring.arg.multiValue[*].value",
			ExpectedRegexp: strPtr("^val1$"),
		},
		{
			// Check that 'val2' is also among the 'multiValue[*].value'
			Path:           "request.querystring.arg.multiValue[*].value",
			ExpectedRegexp: strPtr("^val2$"),
		},
		{
			// Ensure that there are exactly two values in 'multiValue'
			Path:           "length(request.querystring.arg.multiValue)",
			ExpectedRegexp: strPtr("^2$"),
		},
	})
}

func TestAssert_AdvancedJMESPath_Filters(t *testing.T) {
	Assert(t, testObject, []Assertion{
		{
			// Check if any value in 'multiValue' equals 'val2'
			Path:           "request.querystring.arg.multiValue[?value=='val2'] | [0].value",
			ExpectedRegexp: strPtr("^val2$"),
		},
		{
			// Verify that no value equals 'val3'
			Path:   "request.querystring.arg.multiValue[?value=='val3']",
			Exists: false,
		},
	})
}

func TestAssert_InvalidJMESPath(t *testing.T) {
	err := AssertE(testObject, []Assertion{
		{
			Path:   "query[", // Invalid JMESPath
			Exists: true,
		},
	})
	assert.Error(t, err, "Expected error due to invalid JMESPath")
}

func TestAssert_InvalidRegexp(t *testing.T) {
	invalidRegexp := "(" // Invalid regexp
	err := AssertE(testObject, []Assertion{
		{
			Path:           "name",
			Exists:         true,
			ExpectedRegexp: &invalidRegexp,
		},
	})
	assert.Error(t, err, "Expected error due to invalid regexp")
}

func TestAssert_ValueIsNil(t *testing.T) {
	input := map[string]interface{}{
		"name": nil,
	}
	err := AssertE(input, []Assertion{
		{
			Path:   "name",
			Exists: true,
		},
	})
	assert.Error(t, err, "Expected error due to nil value")
}

// Test data, example Edge Function output...
// NOTE: go-jmespath fails on map[]interface{} unless we use a fork
var testObject = map[string]any{
	"status": 200,
	"request": map[string]any{
		"cookies": map[string]any{
			"id": map[string]any{
				"value": "CookeIdValue",
			},
			"loggedIn": map[string]any{
				"value": false,
			},
		},
		"headers": map[string]any{
			"accept": map[string]any{
				// some sample arrays and string pointers
				"multiValue": []map[string]any{
					{
						"value": strPtr("text/html"),
					},
					{
						"value": strPtr("application/xhtml+xml"),
					},
				},
				"value": "text/html",
			},
			"host": map[string]any{
				"value": "www.example.com",
			},
		},
		"method": "GET",
		"querystring": map[string]any{
			"arg": map[string]any{
				"multiValue": []map[string]any{
					{
						"value": "val1",
					},
					{
						"value": "val2",
					},
				},
				"value": "val1",
			},
			"test": map[string]any{
				"value": true,
			},
		},
		"uri": "/index.html",
	},
}

func strPtr(s string) *string {
	return &s
}
