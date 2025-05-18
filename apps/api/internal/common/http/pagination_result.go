package http

type PaginationResult[T any] struct {
	Page  []T `json:"page"`
	Total int `json:"total"`
}

func NewPaginationResult[T any](page []T, total int) PaginationResult[T] {
	return PaginationResult[T]{
		Page:  page,
		Total: total,
	}
}
