package utils

import "regexp"

var urlRegex = regexp.MustCompile(`^(?:https?:)?\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$`)

func IsValidUrl(valueToCheck string) bool {
	return urlRegex.MatchString(valueToCheck)
}
