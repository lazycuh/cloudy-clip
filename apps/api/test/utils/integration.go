package test

import (
	"errors"
	"fmt"
	"net/http/httptest"
	"os"
	"os/exec"
	"sync"
	"testing"
	"time"

	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/orchestrator"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	"github.com/go-chi/chi/v5"
	"github.com/h2non/gock"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/peterldowns/pgtestdb"
)

func Integration(t *testing.T, testGroup func(testServer *httptest.Server)) {
	Test(t, func() {
		testServer := setupTestHttpServerAndDatabase(t)
		defer func() {
			testServer.Close()
			database.Close()

			uncalledMocks := []string{}

			for _, m := range gock.GetAll() {
				if !m.Done() {
					url := m.Request().URLStruct
					uncalledMocks = append(
						uncalledMocks,
						fmt.Sprintf("%-5v %v://%v%v", m.Request().Method, url.Scheme, url.Host, url.RequestURI()),
					)
				}
			}

			if len(uncalledMocks) > 0 {
				debug.PrintJson(map[string]any{
					"uncalledMocks": uncalledMocks,
				})
			}

			if !gock.IsDone() {
				panic(errors.New("uncalled registered HTTP request mocks were found"))
			}
		}()

		testGroup(testServer)
	})
}

func setupTestHttpServerAndDatabase(t *testing.T) *httptest.Server {
	var once sync.Once

	once.Do(func() {
		executionProfile := environment.ExecutionProfile(os.Getenv("CLOUDY_CLIP_EXECUTION_PROFILE"))
		loadEnvFileForExecutionProfile(executionProfile)
		environment.Initialize(executionProfile)
	})

	router := chi.NewRouter()
	testServer := httptest.NewServer(router)

	initializeDatabase(t)

	orchestrator.SetupControllerEndpoints(
		&orchestrator.Config{
			Addr:         testServer.Config.Addr,
			ReadTimeout:  time.Duration(environment.Config.ServerReadTimeout) * time.Second,
			WriteTimeout: time.Duration(environment.Config.ServerWriteTimeout) * time.Second,
			IdleTimeout:  time.Duration(environment.Config.ServerIdleTimeout) * time.Second,
		},
		router,
	)

	return testServer
}

func initializeDatabase(t *testing.T) {
	testDatabaseName := createTestDatabase(t)

	database.InitializeDatabaseClient()

	applyMigrations(testDatabaseName)
}

func applyMigrations(testDatabaseName string) {
	out, err := exec.Command("node", data.ProjectRoot+"/database/apply-migrations.js", testDatabaseName).CombinedOutput()

	fmt.Print(string(out))

	if err != nil {
		panic(err)
	}
}

func createTestDatabase(t *testing.T) string {
	conf := pgtestdb.Custom(
		t,
		pgtestdb.Config{
			DriverName: "pgx",
			Host:       environment.Config.DatabaseHost,
			Port:       environment.Config.DatabasePort,
			Database:   "cloudy-clip-db",
			User:       environment.Config.DatabaseUsername,
			Password:   environment.Config.DatabasePassword,
			Options:    "sslmode=disable",
		},
		pgtestdb.NoopMigrator{},
	)

	environment.Config.DatabaseName = conf.Database

	return conf.Database
}
