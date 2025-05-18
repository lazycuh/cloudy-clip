package test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/test/debug"
)

func CreateRequestBodyMatcher(t *testing.T, expectedJson string, args ...any) gock.MatchFunc {
	return func(r1 *http.Request, r2 *gock.Request) (bool, error) {
		requestBody, err := getRequestBody(r1)
		require.NoError(t, err)

		require.Equal(t, debug.JsonParse(expectedJson, args...), requestBody)

		return true, nil
	}
}

func getRequestBody(request *http.Request) (map[string]any, error) {
	request = request.Clone(context.Background())

	// Content-Type header returns this value
	// `multipart/form-data; boundary=dd91db8e3f63987e841539b149b99c4a218f28263b60bbaa272327faba39`
	// so we need to split it and get the first part
	contentType := strings.Split(request.Header.Get("Content-Type"), ";")[0]

	switch contentType {
	case "application/json":
		var result map[string]any

		return result, json.NewDecoder(request.Body).Decode(&result)

	case "application/x-www-form-urlencoded":
		err := request.ParseForm()
		if err != nil {
			return nil, err
		}

		requestBody := map[string]any{}

		for key, value := range request.PostForm {
			if len(value) == 1 {
				requestBody[key] = value[0]
			} else {
				requestBody[key] = value

			}
		}

		return requestBody, nil

	case "multipart/form-data":
		err := request.ParseMultipartForm(1_000_000)
		if err != nil {
			return nil, err
		}

		requestBody := map[string]any{}

		for key, value := range request.MultipartForm.Value {
			requestBody[key] = string(value[0])
		}

		return requestBody, nil
	}

	return nil, errors.New("unhandled content type '" + contentType + "'")
}

func CreateRequestBodyMatcherFunc(fn func(requestBody map[string]any)) gock.MatchFunc {
	return func(r1 *http.Request, r2 *gock.Request) (bool, error) {
		requestBody, err := getRequestBody(r1)
		if err != nil {
			return false, err
		}

		fn(requestBody)

		return true, nil
	}
}
