package aws

import (
	"encoding/json"
	"fmt"
	"os"
)

type Version string

const Version1_0 Version = "1.0"

func (v *Version) UnmarshalJSON(data []byte) error {
	var versionStr string
	if err := json.Unmarshal(data, &versionStr); err != nil {
		return err
	}
	if versionStr != string(Version1_0) {
		return fmt.Errorf("unsupported version: %s", versionStr)
	}
	*v = Version(versionStr)
	return nil
}

func (v Version) MarshalJSON() ([]byte, error) {
	if v != Version1_0 {
		return nil, fmt.Errorf("unsupported version: %s", v)
	}
	return json.Marshal(string(v))
}

// CloudFrontFunctionEvent represents the event object that you provide to test a CloudFront function.
// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html
type CloudFrontFunctionEvent struct {
	Version  Version   `json:"version"` // The version field contains a string that specifies the version of the CloudFront Functions event object. The current version is 1.0.
	Context  Context   `json:"context"` // The context object contains contextual information about the event
	Viewer   Viewer    `json:"viewer"`
	Request  *Request  `json:"request,omitempty"`
	Response *Response `json:"response,omitempty"`
}

type Context struct {
	DistributionDomainName string `json:"distributionDomainName"` // The CloudFront domain name (for example, d111111abcdef8.cloudfront.net) of the distribution that's associated with the event.
	DistributionID         string `json:"distributionId"`
	EventType              string `json:"eventType"`
	RequestID              string `json:"requestId"`
}

type Viewer struct {
	IP string `json:"ip"`
}

type ValueObject map[string]ValueEntry

type ValueEntry struct {
	Value      string       `json:"value"`
	MultiValue []MultiValue `json:"multiValue,omitempty"`
}

type MultiValue struct {
	Value string `json:"value"`
}

type Request struct {
	Method      string      `json:"method"`
	URI         string      `json:"uri"`
	Querystring ValueObject `json:"querystring"`
	Headers     ValueObject `json:"headers"`
	Cookies     ValueObject `json:"cookies,omitempty"`
}

type Response struct {
	StatusCode        int             `json:"statusCode"`
	StatusDescription *string         `json:"statusDescription,omitempty"`
	Headers           *ValueObject    `json:"headers,omitempty"`
	Cookies           *ResponseCookie `json:"cookies,omitempty"`
}

type ResponseCookie map[string]ResponseCookieEntry

type ResponseCookieEntry struct {
	Value      string            `json:"value"`
	Attributes string            `json:"attributes"`
	MultiValue []MultiValueAttrs `json:"multiValue,omitempty"`
}

type MultiValueAttrs struct {
	Value      string `json:"value"`
	Attributes string `json:"attributes"`
}

func ReadCloudFrontEvent(path string) (*CloudFrontFunctionEvent, error) {
	f, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var t = CloudFrontFunctionEvent{
		Version: "1.0",
		Context: Context{
			EventType: "viewer-request",
		},
		Viewer: Viewer{
			IP: "1.2.3.4",
		},
	}

	err = json.Unmarshal(f, &t)
	return &t, err
}
