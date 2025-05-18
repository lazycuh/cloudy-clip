package main

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
	"encoding/base64"
	"strconv"
	"unsafe"

	"github.com/cespare/xxhash/v2"
)

// ClipboardItem holds the latest clipboard content.
type ClipboardItem struct {
	Fingerprint string
	Text        string // empty if none
	Image       string // empty if none
}

var (
	lastSeenFingerprint uint64
)

// GetLatestClipboardItem retrieves the most recent clipboard item,
// always converting any image into PNG and returning a data URL.
func GetLatestClipboardItem() ClipboardItem {
	var cStr *C.char
	var cImgPtr unsafe.Pointer
	var cImgLen C.int

	if ret := C.getLatestPasteboardItem(&cStr, &cImgPtr, &cImgLen); ret != 0 {
		return ClipboardItem{}
	}
	defer func() {
		if cStr != nil {
			C.free(unsafe.Pointer(cStr))
		}
		if cImgPtr != nil {
			C.free(cImgPtr)
		}
	}()

	item := ClipboardItem{}
	if cStr != nil {
		isNew, contentFingerprint := isClipboardItemContentNew([]byte(C.GoString(cStr)))
		if isNew {
			item.Text = C.GoString(cStr)
			item.Fingerprint = contentFingerprint
		}
	}
	if cImgPtr != nil && cImgLen > 0 {
		imageByteBuffer := C.GoBytes(cImgPtr, cImgLen)
		isNew, contentFingerprint := isClipboardItemContentNew(imageByteBuffer)
		if isNew {
			item.Image = "data:image/png;base64," + base64.StdEncoding.EncodeToString(imageByteBuffer)
			item.Fingerprint = contentFingerprint
		}
	}

	return item
}

// isClipboardItemContentNew returns true exactly when the supplied raw bytes
// produce a different fingerprint than we saw last time.
func isClipboardItemContentNew(contentBytes []byte) (bool, string) {
	contentFingerprint := fingerprint(contentBytes)

	if contentFingerprint != lastSeenFingerprint {
		lastSeenFingerprint = contentFingerprint
		return true, strconv.FormatUint(contentFingerprint, 10)
	}

	return false, ""
}

// fingerprint computes a super-fast 64-bit hash of the raw bytes.
func fingerprint(raw []byte) uint64 {
	return xxhash.Sum64(raw)
}
