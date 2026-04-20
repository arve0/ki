package main

import (
	"io/fs"
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

func registerRoutes(se *core.ServeEvent) {
	// Serve static files
	staticSub, _ := fs.Sub(staticFS, "static")
	fileServer := http.FileServer(http.FS(staticSub))
	se.Router.GET("/static/{path...}", func(e *core.RequestEvent) error {
		http.StripPrefix("/static/", fileServer).ServeHTTP(e.Response, e.Request)
		return nil
	})

	// Public pages
	se.Router.GET("/", handleIndex)
	se.Router.GET("/register", handleRegisterPage)
	se.Router.POST("/register", handleRegister)
	se.Router.GET("/login", handleLoginPage)
	se.Router.POST("/login", handleLogin)
	se.Router.POST("/logout", handleLogout)

	// Protected pages (auth checked in handler)
	se.Router.GET("/timer", handleTimerPage)

	// API endpoints
	api := se.Router.Group("/api/timings")
	api.POST("/start", handleTimingStart)
	api.POST("/{id}/stop", handleTimingStop)
	api.POST("/{id}/add-tag", handleTimingAddTag)
	api.POST("/{id}/remove-tag", handleTimingRemoveTag)
	api.PATCH("/{id}/edit-time", handleTimingEditTime)
	api.PATCH("/{id}/edit-description", handleTimingEditDescription)
	api.GET("/list", handleTimingsList)
	api.GET("/search", handleTimingsSearch)
	api.DELETE("/{id}", handleTimingDelete)
}
