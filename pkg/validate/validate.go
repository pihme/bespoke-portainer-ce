package validate

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

var (
	hexadecimalRegex = regexp.MustCompile(`^[0-9a-fA-F]+$`)
)

func IsURL(urlString string) bool {
	if len(urlString) == 0 {
		return false
	}

	strTemp := urlString
	if !strings.Contains(urlString, "://") {
		// support no indicated urlscheme
		// http:// is appended so url.Parse will succeed
		strTemp = "http://" + urlString
	}

	u, err := url.Parse(strTemp)
	return err == nil && u.Host != ""
}

func IsUUID(uuidString string) bool {
	return uuid.Validate(uuidString) == nil
}

func IsHexadecimal(hexString string) bool {
	return hexadecimalRegex.MatchString(hexString)
}

func IsTrustedOrigin(s string) bool {
	if !strings.Contains(s, "://") {
		return false
	}

	parsedOrigin, err := url.Parse(s)
	if err != nil {
		return false
	}

	if parsedOrigin.Scheme != "http" && parsedOrigin.Scheme != "https" {
		return false
	}

	if parsedOrigin.Host == "" ||
		parsedOrigin.User != nil ||
		parsedOrigin.Path != "" ||
		parsedOrigin.RawQuery != "" ||
		parsedOrigin.Fragment != "" ||
		parsedOrigin.Opaque != "" ||
		parsedOrigin.RawFragment != "" ||
		parsedOrigin.RawPath != "" {
		return false
	}

	return true
}
