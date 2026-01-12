package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/wasilak/grafana-datadog-datasource/pkg/plugin"
)

var logger = log.New()

func main() {
	logger.Info("Plugin main() starting", "pluginId", "wasilak-datadog-datasource")
	
	// Start the datasource backend with instance manager
	if err := datasource.Manage("wasilak-datadog-datasource", plugin.NewDatasource, datasource.ManageOpts{}); err != nil {
		logger.Error("Error serving datasource", "error", err)
		os.Exit(1)
	}
	
	logger.Info("Plugin main() completed successfully")
}
