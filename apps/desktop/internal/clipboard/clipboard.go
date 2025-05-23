package clipboard

/*
#cgo CFLAGS: -x objective-c -framework Cocoa
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>
#include <stdlib.h>

// Fetch the first (most recent) pasteboard item.
// Always returns PNG bytes (malloc’d) or NULL.
// outString: strdup’d UTF-8 string or NULL
// outImageData: malloc’d PNG bytes or NULL, outImageLength the length
// Returns 0 on success, -1 if empty.
int getLatestPasteboardItem(char **outString,
                            void **outImageData,
                            int *outImageLength)
{
    NSPasteboard *pb = [NSPasteboard generalPasteboard];
    NSArray<NSPasteboardItem*> *items = [pb pasteboardItems];
    if (items.count == 0) {
        *outString = NULL;
        *outImageData = NULL;
        *outImageLength = 0;
        return -1;
    }
    NSPasteboardItem *item = items[0];

    // Text
    NSString *s = [item stringForType:NSPasteboardTypeString];
    if (s) {
        *outString = strdup([s UTF8String]);
    } else {
        *outString = NULL;
    }

    // Try raw PNG first
    NSData *png = [item dataForType:NSPasteboardTypePNG];
    if (!png) {
        // Fallback: TIFF → NSImage → PNG
        NSData *tiff = [item dataForType:NSPasteboardTypeTIFF];
        if (tiff) {
            NSImage *img = [[NSImage alloc] initWithData:tiff];
            NSBitmapImageRep *rep =
              [[NSBitmapImageRep alloc] initWithData:[img TIFFRepresentation]];
            png = [rep representationUsingType:NSPNGFileType
                                 properties:@{}];
        }
    }

    if (png) {
        size_t len = png.length;
        void *buf = malloc(len);
        memcpy(buf, png.bytes, len);
        *outImageData   = buf;
        *outImageLength = (int)len;
    } else {
        *outImageData   = NULL;
        *outImageLength = 0;
    }

    return 0;
}
*/
import "C"
import (
	"cloudy-clip/desktop/internal/clipboard/dto"
	"cloudy-clip/desktop/internal/common/database"
	"cloudy-clip/desktop/internal/common/database/generated/model"
	"cloudy-clip/desktop/internal/common/database/generated/table"
	"cloudy-clip/desktop/internal/common/logging"
	"cloudy-clip/desktop/internal/common/utils"
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"github.com/cespare/xxhash/v2"
	"github.com/pkg/errors"
)

var (
	lastSeenFingerprint uint64
	logger              = logging.NewLogger("clipboard", slog.LevelInfo)
)

// GetLatestClipboardItem retrieves the most recent clipboard item,
// always converting any image into PNG and returning a data URL.
func GetLatestClipboardItem() dto.ClipboardItem {
	var cStr *C.char
	var cImgPtr unsafe.Pointer
	var cImgLen C.int

	if ret := C.getLatestPasteboardItem(&cStr, &cImgPtr, &cImgLen); ret != 0 {
		return dto.ClipboardItem{}
	}
	defer func() {
		if cStr != nil {
			C.free(unsafe.Pointer(cStr))
		}
		if cImgPtr != nil {
			C.free(cImgPtr)
		}
	}()

	item := dto.ClipboardItem{}
	if cStr != nil {
		if isClipboardItemContentNew([]byte(C.GoString(cStr))) {
			item.Type = dto.ClipboardItemTypeText
			item.Id = utils.Generate()
			item.Content = strings.TrimSpace(C.GoString(cStr))
			item.CreatedAt = uint64(time.Now().UnixMilli())

			if utils.IsValidUrl(item.Content) {
				item.Type = dto.ClipboardItemTypeUrl
			}

			err := persistClipboardItem(&item, nil)
			if err != nil {
				ctx := context.WithValue(
					context.TODO(),
					logging.LoggerContextCallSiteKey, "GetLatestClipboardItem",
				)

				logger.ErrorAttrs(ctx, err, "failed to persist clipboard item", slog.Any("item", item))

				return dto.ClipboardItem{}
			}
		}
	} else if cImgPtr != nil && cImgLen > 0 {
		imageByteBuffer := C.GoBytes(cImgPtr, cImgLen)
		if isClipboardItemContentNew(imageByteBuffer) {
			item.Id = utils.Generate()
			item.Type = dto.ClipboardItemTypeImage
			item.Content = "data:image/png;base64," + base64.StdEncoding.EncodeToString(imageByteBuffer)
			item.CreatedAt = uint64(time.Now().UnixMilli())

			err := persistClipboardItem(&item, &imageByteBuffer)
			if err != nil {
				ctx := context.WithValue(
					context.Background(),
					logging.LoggerContextCallSiteKey, "GetLatestClipboardItem",
				)

				item.Content = ""

				logger.ErrorAttrs(ctx, err, "failed to persist image clipboard item", slog.Any("item", item))

				return dto.ClipboardItem{}
			}
		}
	}

	return item
}

// isClipboardItemContentNew returns true exactly when the supplied raw bytes
// produce a different fingerprint than we saw last time.
func isClipboardItemContentNew(contentBytes []byte) bool {
	contentFingerprint := fingerprint(contentBytes)

	if contentFingerprint != lastSeenFingerprint {
		lastSeenFingerprint = contentFingerprint

		return true
	}

	return false
}

// fingerprint computes a super-fast 64-bit hash of the raw bytes.
func fingerprint(raw []byte) uint64 {
	return xxhash.Sum64(raw)
}

func persistClipboardItem(item *dto.ClipboardItem, imageByteBuffer *[]byte) error {
	return utils.Retry(func() error {
		if item.Type != dto.ClipboardItemTypeImage {
			return database.Exec(table.ClipboardItemTable.INSERT().MODEL(model.ClipboardItem{
				ID:        item.Id,
				Content:   item.Content,
				Type:      item.Type,
				CreatedAt: item.CreatedAt,
				IsPinned:  item.IsPinned,
				PinnedAt:  item.PinnedAt,
			}))
		}

		if err := storeImageClipboardItem(item, imageByteBuffer); err != nil {
			return err
		}

		return database.Exec(table.ClipboardItemTable.INSERT().MODEL(model.ClipboardItem{
			ID:        item.Id,
			Content:   "",
			Type:      item.Type,
			CreatedAt: item.CreatedAt,
			IsPinned:  item.IsPinned,
			PinnedAt:  item.PinnedAt,
		}))
	})
}

func storeImageClipboardItem(clipboardItem *dto.ClipboardItem, imageByteBuffer *[]byte) error {
	return errors.WithStack(os.WriteFile(resolveImageFilePathForClipboardItem(clipboardItem), *imageByteBuffer, 0644))
}

func resolveImageFilePathForClipboardItem(clipboardItem *dto.ClipboardItem) string {
	return filepath.Join(utils.GetOrCreateDirectory("images"), fmt.Sprintf("%v.png", clipboardItem.Id))
}
