package utils

import (
	"fmt"
	"os"
	"os/user"
	"path/filepath"
)

func GetAppHomeDirectory() string {
	usr, err := user.Current()
	if err != nil {
		panic(fmt.Errorf("failed to get user home directory: %w", err))
	}

	homeDir := usr.HomeDir
	cloudyClipDir := filepath.Join(homeDir, ".cloudy-clip")

	_, err = os.Stat(cloudyClipDir)
	if err == nil {
		return cloudyClipDir
	}

	if os.IsNotExist(err) {
		// Create the directory if it does not exist.
		err := os.Mkdir(cloudyClipDir, 0755) // 0755: drwxr-xr-x permissions
		if err == nil {
			return cloudyClipDir
		}

		panic(fmt.Errorf("failed to create .cloudy-clip directory: %w", err))
	}

	// Handle other errors that may occur during the Stat operation.
	panic(fmt.Errorf("failed to check for .cloudy-clip directory: %w", err))
}

func GetOrCreateDirectory(directoryName string) string {
	directoryPath := filepath.Join(GetAppHomeDirectory(), directoryName)

	_, err := os.Stat(directoryPath)
	if err == nil {
		return directoryPath
	}

	if os.IsNotExist(err) {
		// Create the directory if it does not exist.
		err := os.Mkdir(directoryPath, 0755) // 0755: drwxr-xr-x permissions
		if err == nil {
			return directoryPath
		}

		panic(fmt.Errorf("failed to create directory '%s': %w", directoryName, err))
	}

	panic(fmt.Errorf("failed to check for directory '%s': %w", directoryName, err))
}
