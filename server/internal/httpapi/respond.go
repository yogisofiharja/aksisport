package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

func respondError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

// respondInternal answers 500 "internal error" — the client never sees
// the cause — and attaches err to the request so errorLogMiddleware
// writes it to the server log.
func respondInternal(c *gin.Context, err error) {
	if err == nil {
		err = errors.New("no error detail")
	}
	_ = c.Error(err)
	respondError(c, http.StatusInternalServerError, "internal error")
}
