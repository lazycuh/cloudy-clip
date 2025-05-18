package http

type ExceptionPayload struct {
	Code          string         `json:"code"`
	Message       string         `json:"-"`
	RequestId     string         `json:"requestId"`
	RequestMethod string         `json:"requestMethod"`
	RequestPath   string         `json:"requestPath"`
	Timestamp     string         `json:"timestamp"`
	Extra         map[string]any `json:"extra,omitempty"`
}
