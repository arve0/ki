package main

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"io/fs"
	"math"
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

//go:embed templates
var templateFS embed.FS

//go:embed static
var staticFS embed.FS

var pageTemplates map[string]*template.Template

var funcMap = template.FuncMap{
	"formatDuration": formatDuration,
	"formatTime":     formatTime,
	"formatDate":     formatDate,
	"sub":            func(a, b int) int { return a - b },
	"add":            func(a, b int) int { return a + b },
	"seq":            func(n int) []int { s := make([]int, n); for i := range s { s[i] = i }; return s },
	"dict": func(pairs ...any) map[string]any {
		m := make(map[string]any, len(pairs)/2)
		for i := 0; i < len(pairs)-1; i += 2 {
			key, _ := pairs[i].(string)
			m[key] = pairs[i+1]
		}
		return m
	},
	"contains": func(slice []string, item string) bool {
		for _, s := range slice {
			if s == item {
				return true
			}
		}
		return false
	},
	"eq": func(a, b string) bool { return a == b },
	"localTime": func(dt types.DateTime) string {
		if dt.IsZero() {
			return ""
		}
		return dt.Time().Format("2006-01-02T15:04")
	},
}

func initTemplates() {
	pageTemplates = make(map[string]*template.Template)

	base := "templates/base.html"
	pages := map[string]string{
		"login":    "templates/auth/login.html",
		"register": "templates/auth/register.html",
		"timer":    "templates/timer/timer_page.html",
	}

	for name, page := range pages {
		t := template.Must(
			template.New("").Funcs(funcMap).ParseFS(templateFS, base, page),
		)
		pageTemplates[name] = t
	}

	// Partials
	partials := map[string][]string{
		"timer_controls": {"templates/timer/timer_controls.html"},
		"timings_list":   {"templates/timer/timings_list.html", "templates/timer/timing_item.html"},
		"timing_item":    {"templates/timer/timing_item.html"},
		"timing_edit":    {"templates/timer/timing_edit.html"},
		"search_bar":     {"templates/search/search_bar.html"},
		"filter_bar":     {"templates/search/filter_bar.html"},
	}
	for name, files := range partials {
		t := template.Must(
			template.New("").Funcs(funcMap).ParseFS(templateFS, files...),
		)
		pageTemplates[name] = t
	}
}

func renderPage(e *core.RequestEvent, name string, data any) error {
	t, ok := pageTemplates[name]
	if !ok {
		return e.InternalServerError("Template not found: "+name, nil)
	}

	var buf bytes.Buffer
	if err := t.ExecuteTemplate(&buf, "base", data); err != nil {
		return e.InternalServerError("Template error: "+err.Error(), nil)
	}

	e.Response.Header().Set("Content-Type", "text/html; charset=utf-8")
	e.Response.WriteHeader(http.StatusOK)
	_, err := buf.WriteTo(e.Response)
	return err
}

func renderPartial(e *core.RequestEvent, name, block string, data any) error {
	t, ok := pageTemplates[name]
	if !ok {
		return e.InternalServerError("Template not found: "+name, nil)
	}

	var buf bytes.Buffer
	if err := t.ExecuteTemplate(&buf, block, data); err != nil {
		return e.InternalServerError("Template error: "+err.Error(), nil)
	}

	e.Response.Header().Set("Content-Type", "text/html; charset=utf-8")
	e.Response.WriteHeader(http.StatusOK)
	_, err := buf.WriteTo(e.Response)
	return err
}

func getStaticFS() fs.FS {
	sub, _ := fs.Sub(staticFS, "static")
	return sub
}

func formatDuration(start, stop types.DateTime) string {
	if start.IsZero() {
		return "0s"
	}
	end := stop.Time()
	if stop.IsZero() {
		end = time.Now()
	}
	d := end.Sub(start.Time())
	totalSec := int(math.Floor(d.Seconds()))
	h := totalSec / 3600
	m := (totalSec % 3600) / 60
	s := totalSec % 60

	if h > 0 {
		return fmt.Sprintf("%dt %02dm %02ds", h, m, s)
	}
	if m > 0 {
		return fmt.Sprintf("%dm %02ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}

func formatTime(dt types.DateTime) string {
	if dt.IsZero() {
		return "-"
	}
	return dt.Time().Format("15:04:05")
}

func formatDate(dt types.DateTime) string {
	if dt.IsZero() {
		return "-"
	}
	return dt.Time().Format("02.01.2006")
}
