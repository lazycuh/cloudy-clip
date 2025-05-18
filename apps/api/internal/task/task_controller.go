package task

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/cloudy-clip/api/internal/common/environment"
	_http "github.com/cloudy-clip/api/internal/common/http"
	"github.com/cloudy-clip/api/internal/common/http/middleware/context"
	"github.com/cloudy-clip/api/internal/common/jwt"
	_logger "github.com/cloudy-clip/api/internal/common/logger"
)

var (
	taskService          *TaskService
	taskRepository       *TaskRepository
	taskControllerLogger *_logger.Logger
)

func GetTaskService() *TaskService {
	return taskService
}

func GetTaskRepository() *TaskRepository {
	return taskRepository
}

func SetupTaskControllerEndpoints(parentRouter chi.Router) {
	taskRepository = NewTaskRepository()
	taskService = NewTaskService()
	taskControllerLogger = _logger.NewLogger("TaskController", slog.Level(environment.Config.ApplicationLogLevel))

	parentRouter.Route("/v1/tasks", func(v1Router chi.Router) {
		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingTask"),
				jwt.JwtVerifierMiddleware(taskControllerLogger))

			router.Get("/{taskId}", handleGettingTask())
		})
	})
}

func handleGettingTask() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			taskId := chi.URLParam(request, "taskId")

			return taskService.GetTask(request.Context(), taskId)
		},
	)
}
