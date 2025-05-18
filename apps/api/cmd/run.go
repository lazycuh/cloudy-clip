package cmd

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/orchestrator"
)

func Run(conf *orchestrator.Config, mux *chi.Mux) error {
	database.InitializeDatabaseClient()
	orchestrator.SetupControllerEndpoints(conf, mux)

	// Prepare server with CloudFlare recommendation timeouts config.
	// See: https://blog.cloudflare.com/the-complete-guide-to-golang-net-http-timeouts/
	server := &http.Server{
		Handler:      mux,
		Addr:         conf.Addr,
		ReadTimeout:  conf.ReadTimeout,
		WriteTimeout: conf.WriteTimeout,
		IdleTimeout:  conf.IdleTimeout,
	}

	return server.ListenAndServe()
}
