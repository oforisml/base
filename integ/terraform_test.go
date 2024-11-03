package integ

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/files"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/require"
)

func TestTerraformOutputJMES(t *testing.T) {
	t.Parallel()

	testFolder, err := files.CopyTerraformFolderToTemp("./fixtures/terraform-output-all", t.Name())
	if err != nil {
		t.Fatal(err)
	}

	options := &terraform.Options{
		TerraformDir: testFolder,
	}

	terraform.InitAndApply(t, options)
	tests := []struct {
		query         string
		expectedValue interface{}
		description   string
	}{
		{
			query:         "our_star",
			expectedValue: "Sun",
			description:   "string",
		},
		{
			query:         "stars[2]",
			expectedValue: "Betelgeuse",
			description:   "list",
		},
		{
			query:         "constellations.Taurus",
			expectedValue: "Aldebaran",
			description:   "map value",
		},
		{
			query:         "constellations.keys(@) | sort(@)",
			expectedValue: []interface{}{"Gemini", "Scorpio", "Taurus", "Virgo"},
			description:   "map keys",
		},
		{
			query:         "constellations.values(@) | sort(@)",
			expectedValue: []interface{}{"Aldebaran", "Antares", "Pollux", "Spica"},
			description:   "map values",
		},
	}

	for _, tt := range tests {
		t.Run(tt.description, func(t *testing.T) {
			result := TerraformOutputJMESAny(t, options, tt.query)
			require.Equal(t, tt.expectedValue, result,
				"JMESPath query %q should return %v, got %v", tt.query, tt.expectedValue, result)
		})
	}
}

func TestTerraformOutputJMES_Generics(t *testing.T) {
	t.Parallel()

	testFolder, err := files.CopyTerraformFolderToTemp("./fixtures/terraform-output-all", t.Name())
	if err != nil {
		t.Fatal(err)
	}

	options := &terraform.Options{
		TerraformDir: testFolder,
	}

	terraform.InitAndApply(t, options)

	query := "constellations.keys(@) | sort(@)"
	expectedValue := []string{"Gemini", "Scorpio", "Taurus", "Virgo"}
	result := TerraformOutputJMES[[]string](t, options, query)
	require.Equal(t, expectedValue, result,
		"JMESPath query %q should return %v, got %v", query, expectedValue, result)
}
