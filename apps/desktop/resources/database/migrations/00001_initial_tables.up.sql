CREATE TABLE tbl_clipboard_item (
    id CHAR(26) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR NOT NULL,
    created_at BIGINT NOT NULL,
    is_pinned BOOLEAN NOT NULL,
    pinned_at BIGINT NOT NULL,
    CONSTRAINT pk__clipboard_item PRIMARY KEY (id)
);
