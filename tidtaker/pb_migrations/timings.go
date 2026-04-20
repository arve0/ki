package pb_migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"
)

func init() {
	migrations.Register(func(app core.App) error {
		collection := core.NewBaseCollection("timings")

		collection.Fields.Add(
			&core.TextField{
				Name:     "userId",
				Required: true,
			},
			&core.TextField{
				Name: "description",
			},
			&core.JSONField{
				Name:    "tags",
				MaxSize: 2000,
			},
			&core.DateField{
				Name:     "startTime",
				Required: true,
			},
			&core.DateField{
				Name: "stopTime",
			},
			&core.BoolField{
				Name: "isActive",
			},
		)

		// Disable default CRUD API rules (we use custom endpoints)
		collection.ListRule = nil
		collection.ViewRule = nil
		collection.CreateRule = nil
		collection.UpdateRule = nil
		collection.DeleteRule = nil

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("timings")
		if err != nil {
			return err
		}
		return app.Delete(collection)
	})
}
