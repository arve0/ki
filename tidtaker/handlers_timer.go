package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Start a new timing
func handleTimingStart(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	// Stop any active timing first
	activeTiming, _ := e.App.FindFirstRecordByFilter(
		"timings",
		"userId = {:userId} && isActive = true",
		dbx.Params{"userId": auth.Id},
	)
	if activeTiming != nil {
		activeTiming.Set("isActive", false)
		activeTiming.Set("stopTime", time.Now().UTC().Format(time.RFC3339))
		_ = e.App.Save(activeTiming)
	}

	collection, err := e.App.FindCollectionByNameOrId("timings")
	if err != nil {
		return e.InternalServerError("Collection not found", err)
	}

	record := core.NewRecord(collection)
	record.Set("userId", auth.Id)
	record.Set("description", "")
	record.Set("tags", "[]")
	record.Set("startTime", time.Now().UTC().Format(time.RFC3339))
	record.Set("stopTime", "")
	record.Set("isActive", true)

	if err := e.App.Save(record); err != nil {
		return e.InternalServerError("Could not start timing", err)
	}

	return renderTimerControls(e, auth, record)
}

// Stop a timing
func handleTimingStop(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	id := e.Request.PathValue("id")
	record, err := e.App.FindRecordById("timings", id)
	if err != nil || record.GetString("userId") != auth.Id {
		return e.NotFoundError("Timing not found", nil)
	}

	record.Set("isActive", false)
	record.Set("stopTime", time.Now().UTC().Format(time.RFC3339))

	if err := e.App.Save(record); err != nil {
		return e.InternalServerError("Could not stop timing", err)
	}

	return renderTimerControls(e, auth, nil)
}

// Add tag to timing
func handleTimingAddTag(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	id := e.Request.PathValue("id")
	record, err := e.App.FindRecordById("timings", id)
	if err != nil || record.GetString("userId") != auth.Id {
		return e.NotFoundError("Timing not found", nil)
	}

	tag := strings.TrimSpace(e.Request.FormValue("tag"))
	if tag == "" {
		return e.BadRequestError("Tag cannot be empty", nil)
	}

	tags := record.GetStringSlice("tags")
	if !slices.Contains(tags, tag) {
		tags = append(tags, tag)
		tagsJSON, _ := json.Marshal(tags)
		record.Set("tags", string(tagsJSON))
		if err := e.App.Save(record); err != nil {
			return e.InternalServerError("Could not add tag", err)
		}
	}

	return renderTimingItem(e, record)
}

// Remove tag from timing
func handleTimingRemoveTag(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	id := e.Request.PathValue("id")
	record, err := e.App.FindRecordById("timings", id)
	if err != nil || record.GetString("userId") != auth.Id {
		return e.NotFoundError("Timing not found", nil)
	}

	tag := strings.TrimSpace(e.Request.FormValue("tag"))
	tags := record.GetStringSlice("tags")
	newTags := make([]string, 0, len(tags))
	for _, t := range tags {
		if t != tag {
			newTags = append(newTags, t)
		}
	}
	tagsJSON, _ := json.Marshal(newTags)
	record.Set("tags", string(tagsJSON))

	if err := e.App.Save(record); err != nil {
		return e.InternalServerError("Could not remove tag", err)
	}

	return renderTimingItem(e, record)
}

// Edit timing start/stop time
func handleTimingEditTime(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	id := e.Request.PathValue("id")
	record, err := e.App.FindRecordById("timings", id)
	if err != nil || record.GetString("userId") != auth.Id {
		return e.NotFoundError("Timing not found", nil)
	}

	startTimeStr := e.Request.FormValue("startTime")
	stopTimeStr := e.Request.FormValue("stopTime")

	if startTimeStr != "" {
		t, err := time.Parse("2006-01-02T15:04", startTimeStr)
		if err != nil {
			return e.BadRequestError("Invalid start time format", err)
		}
		record.Set("startTime", t.UTC().Format(time.RFC3339))
	}

	if stopTimeStr != "" {
		t, err := time.Parse("2006-01-02T15:04", stopTimeStr)
		if err != nil {
			return e.BadRequestError("Invalid stop time format", err)
		}
		record.Set("stopTime", t.UTC().Format(time.RFC3339))
		record.Set("isActive", false)
	}

	if err := e.App.Save(record); err != nil {
		return e.InternalServerError("Could not update timing", err)
	}

	return renderTimingItem(e, record)
}

// Edit timing description
func handleTimingEditDescription(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	id := e.Request.PathValue("id")
	record, err := e.App.FindRecordById("timings", id)
	if err != nil || record.GetString("userId") != auth.Id {
		return e.NotFoundError("Timing not found", nil)
	}

	description := e.Request.FormValue("description")
	record.Set("description", description)

	if err := e.App.Save(record); err != nil {
		return e.InternalServerError("Could not update description", err)
	}

	return renderTimingItem(e, record)
}

// Delete timing
func handleTimingDelete(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	id := e.Request.PathValue("id")
	record, err := e.App.FindRecordById("timings", id)
	if err != nil || record.GetString("userId") != auth.Id {
		return e.NotFoundError("Timing not found", nil)
	}

	if err := e.App.Delete(record); err != nil {
		return e.InternalServerError("Could not delete timing", err)
	}

	return e.HTML(http.StatusOK, "")
}

// List timings with pagination
func handleTimingsList(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	page := max(1, getIntParam(e, "page", 1))
	perPage := 10
	offset := (page - 1) * perPage

	timings, _ := e.App.FindRecordsByFilter(
		"timings",
		"userId = {:userId}",
		"-startTime",
		perPage,
		offset,
		dbx.Params{"userId": auth.Id},
	)

	hasMore := len(timings) >= perPage

	return renderPartial(e, "timings_list", "timings_list", map[string]any{
		"Timings": timings,
		"Page":    page,
		"HasMore": hasMore,
	})
}

// Search timings
func handleTimingsSearch(e *core.RequestEvent) error {
	auth, err := requireAuth(e)
	if err != nil {
		return err
	}

	query := strings.TrimSpace(e.Request.URL.Query().Get("q"))
	filterTags := e.Request.URL.Query()["tags"]
	sort := e.Request.URL.Query().Get("sort")
	page := max(1, getIntParam(e, "page", 1))
	perPage := 10
	offset := (page - 1) * perPage

	if sort == "" {
		sort = "-startTime"
	}

	filter := "userId = {:userId}"
	params := dbx.Params{"userId": auth.Id}

	// Build search filter from query words
	if query != "" {
		words := strings.Fields(query)
		for i, word := range words {
			paramName := fmt.Sprintf("q%d", i)
			filter += fmt.Sprintf(" && (description ~ {:%s} || tags ~ {:%s})", paramName, paramName)
			params[paramName] = word
		}
	}

	// Filter by tags
	if len(filterTags) > 0 {
		for i, tag := range filterTags {
			paramName := fmt.Sprintf("tag%d", i)
			filter += fmt.Sprintf(" && tags ~ {:%s}", paramName)
			params[paramName] = tag
		}
	}

	timings, _ := e.App.FindRecordsByFilter(
		"timings",
		filter,
		sort,
		perPage,
		offset,
		params,
	)

	hasMore := len(timings) >= perPage

	return renderPartial(e, "timings_list", "timings_list", map[string]any{
		"Timings":    timings,
		"Page":       page,
		"HasMore":    hasMore,
		"Query":      query,
		"FilterTags": filterTags,
		"Sort":       sort,
	})
}

// Helper: render timer controls partial
func renderTimerControls(e *core.RequestEvent, auth *core.Record, activeTiming *core.Record) error {
	// Also fetch recent timings for the list update
	timings, _ := e.App.FindRecordsByFilter(
		"timings",
		"userId = {:userId}",
		"-startTime",
		10,
		0,
		dbx.Params{"userId": auth.Id},
	)

	allTags := collectAllTags(timings)

	data := map[string]any{
		"Auth":         auth,
		"ActiveTiming": activeTiming,
		"Timings":      timings,
		"AllTags":      allTags,
		"Page":         1,
		"HasMore":      len(timings) >= 10,
	}

	return renderPartial(e, "timer_controls", "timer_section", data)
}

// Helper: render single timing item
func renderTimingItem(e *core.RequestEvent, record *core.Record) error {
	return renderPartial(e, "timing_item", "timing_item", map[string]any{
		"Timing": record,
	})
}

func getIntParam(e *core.RequestEvent, name string, defaultVal int) int {
	val := e.Request.URL.Query().Get(name)
	if val == "" {
		return defaultVal
	}
	n := 0
	for _, c := range val {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		} else {
			return defaultVal
		}
	}
	return n
}

// Helper to get DateTime for templates
func getDateTime(record *core.Record, key string) types.DateTime {
	return record.GetDateTime(key)
}
