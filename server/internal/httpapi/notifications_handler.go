package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/notify"
)

// DP-018: devices that receive pushes, and the Notifications page.
func RegisterNotificationRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, notifier *notify.Service) {
	profiled := rg.Group("")
	profiled.Use(authjwt.RequireAuth(verifier))
	profiled.Use(authjwt.RequireProfile(pool))

	// The key a browser subscribes with (Web Push applicationServerKey).
	profiled.GET("/push/web-public-key", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"publicKey": notifier.WebPublicKey()})
	})

	// Register this device for the caller. Called again on every sign-in
	// so a device follows whoever is signed in on it.
	profiled.POST("/me/push-subscriptions", func(c *gin.Context) {
		var body struct {
			Kind     string `json:"kind"`
			Endpoint string `json:"endpoint"` // web
			Keys     struct {
				P256dh string `json:"p256dh"`
				Auth   string `json:"auth"`
			} `json:"keys"` // web
			Token  string `json:"token"` // expo
			Locale string `json:"locale"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		locale := "en"
		if strings.HasPrefix(body.Locale, "id") {
			locale = "id"
		}
		sub := dbpkg.PushSubscription{UserID: authjwt.CurrentUser(c).ID, Kind: body.Kind, Locale: locale}
		switch body.Kind {
		case "web":
			if !strings.HasPrefix(body.Endpoint, "https://") || body.Keys.P256dh == "" || body.Keys.Auth == "" {
				respondError(c, http.StatusBadRequest, "endpoint and keys are required")
				return
			}
			sub.Address, sub.P256dh, sub.Auth = body.Endpoint, &body.Keys.P256dh, &body.Keys.Auth
		case "expo":
			if !strings.HasPrefix(body.Token, "ExponentPushToken[") && !strings.HasPrefix(body.Token, "ExpoPushToken[") {
				respondError(c, http.StatusBadRequest, "an Expo push token is required")
				return
			}
			sub.Address = body.Token
		default:
			respondError(c, http.StatusBadRequest, `kind must be "web" or "expo"`)
			return
		}
		if err := dbpkg.UpsertPushSubscription(c.Request.Context(), pool, sub); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// Stop pushing to this device (signing out). Body {address}: the web
	// endpoint or the Expo token.
	profiled.DELETE("/me/push-subscriptions", func(c *gin.Context) {
		var body struct {
			Address string `json:"address"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Address == "" {
			respondError(c, http.StatusBadRequest, "address is required")
			return
		}
		if err := dbpkg.DeletePushSubscription(c.Request.Context(), pool, authjwt.CurrentUser(c).ID, body.Address); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	profiled.GET("/me/notifications", func(c *gin.Context) {
		limit := 50
		if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 && v <= 200 {
			limit = v
		}
		list, err := dbpkg.ListNotifications(c.Request.Context(), pool, authjwt.CurrentUser(c).ID, limit)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, list)
	})

	profiled.GET("/me/notifications/unread-count", func(c *gin.Context) {
		count, err := dbpkg.CountUnreadNotifications(c.Request.Context(), pool, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": count})
	})

	profiled.POST("/me/notifications/read-all", func(c *gin.Context) {
		if err := dbpkg.MarkAllNotificationsRead(c.Request.Context(), pool, authjwt.CurrentUser(c).ID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	profiled.POST("/me/notifications/:id/read", func(c *gin.Context) {
		err := dbpkg.MarkNotificationRead(c.Request.Context(), pool, authjwt.CurrentUser(c).ID, c.Param("id"))
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "notification not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})
}
