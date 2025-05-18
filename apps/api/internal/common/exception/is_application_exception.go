package exception

func IsApplicationException(err error) bool {
	return IsOfExceptionType[Exception](err)
}
