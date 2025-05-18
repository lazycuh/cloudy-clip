package dto

import "time"

type UserSession struct {
	Id        string    `json:"-"`
	UserId    string    `json:"userId"`
	Email     string    `json:"email"`
	ExpiresAt time.Time `json:"expiresAt"`
	Ip        string    `json:"ip"`
	UserAgent string    `json:"userAgent"`
}

func (userSession *UserSession) IsExpired() bool {
	return userSession.ExpiresAt.Before(time.Now())
}
