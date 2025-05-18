package http

import (
	"net/http"
	"time"
)

func SetCookieWithMaxAge(
	responseWriter http.ResponseWriter,
	cookieName string,
	cookieValue string,
	maxAgeInMinutes int,
) {
	cookie := http.Cookie{
		Name:     cookieName,
		Value:    cookieValue,
		SameSite: http.SameSiteStrictMode,
		HttpOnly: true,
		MaxAge:   maxAgeInMinutes * 60,
		Path:     "/api",
		Secure:   true,
	}

	http.SetCookie(responseWriter, &cookie)
}

func SetCookieWithExpiration(
	responseWriter http.ResponseWriter,
	cookieName string,
	cookieValue string,
	expiration time.Time,
) {
	cookie := http.Cookie{
		Name:     cookieName,
		Value:    cookieValue,
		SameSite: http.SameSiteStrictMode,
		HttpOnly: true,
		Expires:  expiration,
		Path:     "/api",
		Secure:   true,
	}

	http.SetCookie(responseWriter, &cookie)
}

func RemoveCookie(responseWriter http.ResponseWriter, cookieName string) {
	cookie := http.Cookie{
		Name:     cookieName,
		Value:    "",
		SameSite: http.SameSiteStrictMode,
		HttpOnly: true,
		Expires:  time.Unix(-1, 0),
		Path:     "/api",
		Secure:   true,
	}

	http.SetCookie(responseWriter, &cookie)
}
