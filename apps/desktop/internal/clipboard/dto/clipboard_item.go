package dto

import (
	"encoding/json"
	"errors"
	"fmt"
)

type ClipboardItemType byte

const (
	ClipboardItemTypeUnknown ClipboardItemType = iota
	ClipboardItemTypeText
	ClipboardItemTypeImage
	ClipboardItemTypeUrl
)

func (itemType ClipboardItemType) MarshalJSON() ([]byte, error) {
	return []byte(`"` + itemType.String() + `"`), nil
}

func (itemType ClipboardItemType) String() string {
	switch itemType {
	case ClipboardItemTypeText:
		return "TEXT"
	case ClipboardItemTypeImage:
		return "IMAGE"
	case ClipboardItemTypeUrl:
		return "URL"
	case ClipboardItemTypeUnknown:
		return "UNKNOWN"
	}

	panic(fmt.Sprintf("unknown clipboard content item type '%d'", itemType))
}

func (itemType *ClipboardItemType) UnmarshalJSON(buf []byte) error {
	var itemTypeString string
	err := json.Unmarshal(buf, &itemTypeString)
	if err != nil {
		return err
	}

	switch itemTypeString {
	case "TEXT":
		*itemType = ClipboardItemTypeText
	case "IMAGE":
		*itemType = ClipboardItemTypeImage
	case "URL":
		*itemType = ClipboardItemTypeUrl
	case "UNKNOWN":
		*itemType = ClipboardItemTypeUnknown
	}

	return errors.New("unknown content item type '" + itemTypeString + "'")
}

type ClipboardItem struct {
	Id        string            `json:"id"`
	Type      ClipboardItemType `json:"type" ts_type:"'TEXT'|'IMAGE'|'URL'"`
	Content   string            `json:"content"`
	CreatedAt uint64            `json:"createdAt"`
	IsPinned  bool              `json:"isPinned"`
	PinnedAt  uint64            `json:"pinnedAt"`
}
