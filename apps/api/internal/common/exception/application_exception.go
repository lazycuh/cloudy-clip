package exception

type Exception interface {
	GetMessage() string
	GetExtra() map[string]any
	GetStatusCode() int
	Error() string
}

type ApplicationException struct {
	Message    string         `json:"message"`
	StatusCode int            `json:"-"`
	Extra      map[string]any `json:"extra,omitempty"`
}

func (err ApplicationException) GetMessage() string {
	return err.Message
}

func (err ApplicationException) GetStatusCode() int {
	return err.StatusCode
}

func (err ApplicationException) GetExtra() map[string]any {
	return err.Extra
}

func (error ApplicationException) Error() string {
	return error.Message
}
