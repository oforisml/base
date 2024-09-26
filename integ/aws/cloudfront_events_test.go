package aws

import (
	"testing"
)

func TestReadCloudFrontEvent(t *testing.T) {
	// Test case 1: Valid event file path
	eventPath := "./edge/testevents/url-rewrite-spa/file-name-and-extension.json"
	event, err := ReadCloudFrontEvent(eventPath)
	if err != nil {
		t.Errorf("Failed to read event from file: %s", err)
	}

	// Verify the event properties
	if event.Version != Version1_0 {
		t.Errorf("Expected event version %s, got %s", Version1_0, event.Version)
	}
}
