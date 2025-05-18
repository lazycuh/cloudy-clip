# Create self-signed certificate

```shell
openssl  req -x509 -nodes -days 3650 -newkey rsa:4096 -keyout cloudy-clip-key.pem -out cloudy-clip-cert.pem
```

# Convert X509 certificate to PKCS12 format

```shell
openssl pkcs12 -export -out cert.p12 -inkey key.pem -in cert.pem
```

# Generate randomly-secure hex-encoded string

```shell
openssl rand -hex 32
```

# Stripe resources

- [Payment decline codes](https://docs.stripe.com/declines)
- [Payment error codes](https://docs.stripe.com/error-codes)
- [Test cards](https://docs.stripe.com/testing)

## Development set up

- Rename app name
- Rename environment variable prefix
- Update support email in `common/get-support-email-link`
- Update `__ORIGIN__` value in `web/angular.json`
- Update `__STRIPE_API_KEY__` value in `web/angular.json`
- Set up facebook login at https://developers.facebook.com/
- Set up google login at https://console.cloud.google.com/
  - Go to **APIs & Services**
- Create a new Turnstile widget on https://dash.cloudflare.com
  - Update `siteKey` property in `turnstile-form-field.component.ts` file
- Create `.env.development` file from `.env.template` in **api** folder and fill in Oauth2 keys and secrets
