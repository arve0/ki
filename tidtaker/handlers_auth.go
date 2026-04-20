package main

import (
	"net/http"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

const authCookieName = "pb_auth"

func getAuthRecord(e *core.RequestEvent) *core.Record {
	// First check if PocketBase already resolved auth (e.g. via Authorization header)
	if e.Auth != nil {
		return e.Auth
	}

	// Try cookie-based auth
	cookie, err := e.Request.Cookie(authCookieName)
	if err != nil || cookie.Value == "" {
		return nil
	}

	record, err := e.App.FindAuthRecordByToken(cookie.Value, core.TokenTypeAuth)
	if err != nil {
		return nil
	}

	return record
}

func setAuthCookie(e *core.RequestEvent, token string) {
	e.SetCookie(&http.Cookie{
		Name:     authCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   60 * 60 * 24 * 30, // 30 days
	})
}

func clearAuthCookie(e *core.RequestEvent) {
	e.SetCookie(&http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

func requireAuth(e *core.RequestEvent) (*core.Record, error) {
	auth := getAuthRecord(e)
	if auth == nil {
		if e.Request.Header.Get("HX-Request") == "true" {
			e.Response.Header().Set("HX-Redirect", "/login")
			return nil, e.HTML(http.StatusUnauthorized, "")
		}
		return nil, e.Redirect(http.StatusSeeOther, "/login")
	}
	return auth, nil
}

// Index page - redirect based on auth status
func handleIndex(e *core.RequestEvent) error {
	if getAuthRecord(e) != nil {
		return e.Redirect(http.StatusSeeOther, "/timer")
	}
	return e.Redirect(http.StatusSeeOther, "/login")
}

// Register page
func handleRegisterPage(e *core.RequestEvent) error {
	if getAuthRecord(e) != nil {
		return e.Redirect(http.StatusSeeOther, "/timer")
	}
	return renderPage(e, "register", map[string]any{
		"Error": "",
	})
}

// Handle registration
func handleRegister(e *core.RequestEvent) error {
	email := e.Request.FormValue("email")
	password := e.Request.FormValue("password")
	passwordConfirm := e.Request.FormValue("passwordConfirm")

	if email == "" || password == "" {
		return renderPage(e, "register", map[string]any{
			"Error": "E-post og passord er påkrevd.",
			"Email": email,
		})
	}

	if password != passwordConfirm {
		return renderPage(e, "register", map[string]any{
			"Error": "Passordene samsvarer ikke.",
			"Email": email,
		})
	}

	if len(password) < 8 {
		return renderPage(e, "register", map[string]any{
			"Error": "Passordet må være minst 8 tegn.",
			"Email": email,
		})
	}

	collection, err := e.App.FindCollectionByNameOrId("users")
	if err != nil {
		return renderPage(e, "register", map[string]any{
			"Error": "Intern feil. Prøv igjen.",
			"Email": email,
		})
	}

	record := core.NewRecord(collection)
	record.SetEmail(email)
	record.SetPassword(password)

	if err := e.App.Save(record); err != nil {
		return renderPage(e, "register", map[string]any{
			"Error": "Kunne ikke opprette bruker. E-posten kan allerede være i bruk.",
			"Email": email,
		})
	}

	token, err := record.NewAuthToken()
	if err != nil {
		return renderPage(e, "register", map[string]any{
			"Error": "Bruker opprettet, men innlogging feilet. Prøv å logge inn.",
			"Email": email,
		})
	}

	setAuthCookie(e, token)
	return e.Redirect(http.StatusSeeOther, "/timer")
}

// Login page
func handleLoginPage(e *core.RequestEvent) error {
	if getAuthRecord(e) != nil {
		return e.Redirect(http.StatusSeeOther, "/timer")
	}
	return renderPage(e, "login", map[string]any{
		"Error": "",
	})
}

// Handle login
func handleLogin(e *core.RequestEvent) error {
	email := e.Request.FormValue("email")
	password := e.Request.FormValue("password")

	if email == "" || password == "" {
		return renderPage(e, "login", map[string]any{
			"Error": "E-post og passord er påkrevd.",
			"Email": email,
		})
	}

	record, err := e.App.FindAuthRecordByEmail("users", email)
	if err != nil || !record.ValidatePassword(password) {
		return renderPage(e, "login", map[string]any{
			"Error": "Ugyldig e-post eller passord.",
			"Email": email,
		})
	}

	token, err := record.NewAuthToken()
	if err != nil {
		return renderPage(e, "login", map[string]any{
			"Error": "Innlogging feilet. Prøv igjen.",
			"Email": email,
		})
	}

	setAuthCookie(e, token)

	if e.Request.Header.Get("HX-Request") == "true" {
		e.Response.Header().Set("HX-Redirect", "/timer")
		return e.HTML(http.StatusOK, "")
	}

	return e.Redirect(http.StatusSeeOther, "/timer")
}

// Logout
func handleLogout(e *core.RequestEvent) error {
	clearAuthCookie(e)
	if e.Request.Header.Get("HX-Request") == "true" {
		e.Response.Header().Set("HX-Redirect", "/login")
		return e.HTML(http.StatusOK, "")
	}
	return e.Redirect(http.StatusSeeOther, "/login")
}

// Timer page
func handleTimerPage(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	// Check for active timing
	activeTiming, _ := e.App.FindFirstRecordByFilter(
		"timings",
		"userId = {:userId} && isActive = true",
		dbx.Params{"userId": auth.Id},
	)

	// Get recent timings
	timings, _ := e.App.FindRecordsByFilter(
		"timings",
		"userId = {:userId}",
		"-startTime",
		10,
		0,
		dbx.Params{"userId": auth.Id},
	)

	// Collect all unique tags
	allTags := collectAllTags(timings)

	return renderPage(e, "timer", map[string]any{
		"Auth":          auth,
		"ActiveTiming":  activeTiming,
		"Timings":       timings,
		"AllTags":       allTags,
		"Page":          1,
		"HasMore":       len(timings) >= 10,
		"Query":         "",
		"FilterTags":    []string{},
		"Sort":          "-startTime",
		"Now":           time.Now(),
	})
}

func collectAllTags(timings []*core.Record) []string {
	tagSet := make(map[string]bool)
	for _, t := range timings {
		tags := t.GetStringSlice("tags")
		for _, tag := range tags {
			if tag != "" {
				tagSet[tag] = true
			}
		}
	}
	result := make([]string, 0, len(tagSet))
	for tag := range tagSet {
		result = append(result, tag)
	}
	return result
}
