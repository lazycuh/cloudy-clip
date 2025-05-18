#!/bin/bash

set -e

go get -u github.com/joho/godotenv
go get -u github.com/caarlos0/env/v11
go get -u github.com/go-playground/validator/v10
go get -u github.com/golang-jwt/jwt/v5
go get -u github.com/jackc/pgx/v5
go get -u github.com/lib/pq
go get -u github.com/mailgun/mailgun-go/v4
go get -u github.com/maypok86/otter
go get -u github.com/oklog/ulid/v2
go get -u github.com/pkg/errors
go get -u golang.org/x/crypto
go get -u golang.org/x/oauth2
go get -u github.com/go-jet/jet/v2
go get -u github.com/iancoleman/strcase

# Test dependencies
go get -u github.com/stretchr/testify
go get -u github.com/h2non/gock
go get -u github.com/peterldowns/pgtestdb
