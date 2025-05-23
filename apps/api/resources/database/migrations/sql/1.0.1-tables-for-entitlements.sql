CREATE TABLE tbl_plan (
    plan_id CHAR(26) NOT NULL,
    display_name VARCHAR(32) NOT NULL,
    CONSTRAINT pk__plan PRIMARY KEY (plan_id)
);

INSERT INTO
    tbl_plan(plan_id, display_name)
VALUES
    ('01J7EVJ6F4K87YJVX9JE7ZSZED', 'Free'),
    ('01J7EVJFS58YH6HSYNCDWJE4JW', 'Lite'),
    ('01J7EVJNRPXY17SESDS7DY65Y1', 'Essential');

CREATE TABLE tbl_plan_offering (
    plan_offering_id CHAR(26) NOT NULL,
    price VARCHAR NOT NULL,
    discounted_price VARCHAR NOT NULL,
    renewed_in VARCHAR(8) NOT NULL,
    plan_id CHAR(26) NOT NULL,
    CONSTRAINT pk__plan_offering PRIMARY KEY (plan_offering_id),
    CONSTRAINT fk__plan_offering_plan FOREIGN KEY (plan_id) REFERENCES tbl_plan(plan_id) ON DELETE CASCADE
);

INSERT INTO
    tbl_plan_offering(plan_offering_id, price, discounted_price, renewed_in, plan_id)
VALUES
    ('01J9FAJGRYSF5Y1338HSE07SB8', '0', '0', '1m', '01J7EVJ6F4K87YJVX9JE7ZSZED'),
    ('01J9FNB8FZ2XT4NVF9BPQP7Q5G', '0', '0', '1y', '01J7EVJ6F4K87YJVX9JE7ZSZED'),
    ('01J9FAJQBCAFBCG5ZV0JE1NDJA', '199', '199', '1m', '01J7EVJFS58YH6HSYNCDWJE4JW'),
    ('01J9FNBNXCHKKC8686BDM19C59', '2388', '1990', '1y', '01J7EVJFS58YH6HSYNCDWJE4JW'),
    ('01J9FAJY010PPGWYABP8VSSHCV', '399', '399', '1m', '01J7EVJNRPXY17SESDS7DY65Y1'),
    ('01J9FNBYVG59GCHESE64WTG30W', '4788', '3990', '1y', '01J7EVJNRPXY17SESDS7DY65Y1');

CREATE TABLE tbl_plan_entitlement (
    plan_entitlement_id CHAR(26) NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    quantity SMALLINT NOT NULL CHECK (quantity >= 0),
    restricted BOOLEAN NOT NULL,
    plan_id CHAR(26) NOT NULL,
    CONSTRAINT pk__plan_entitlement PRIMARY KEY (plan_entitlement_id),
    CONSTRAINT fk__plan_entitlement_plan FOREIGN KEY (plan_id) REFERENCES tbl_plan(plan_id) ON DELETE CASCADE
);

INSERT INTO
    tbl_plan_entitlement(plan_entitlement_id, "type", quantity, restricted, plan_id)
VALUES
    -- Free
    (
        '01J7EVKDD9V675PRGH48K6YANA',
        'WORD_COUNT',
        250,
        true,
        '01J7EVJ6F4K87YJVX9JE7ZSZED'
    ),
    (
        '01J7EVKGRGVM9HNN6S2E7T2RKF',
        'IMAGE_UPLOAD',
        0,
        true,
        '01J7EVJ6F4K87YJVX9JE7ZSZED'
    ),
    (
        '01J7EVKM98Y01E7C6Q1K2TAXYM',
        'RETENTION_PERIOD',
        30,
        true,
        '01J7EVJ6F4K87YJVX9JE7ZSZED'
    ),
    -- Lite
    (
        '01J7EVKSTCCRW9DAYM6G21G3XN',
        'WORD_COUNT',
        0,
        false,
        '01J7EVJFS58YH6HSYNCDWJE4JW'
    ),
    (
        '01J7EVKY6VN1Z01WCKZ4B5MC9Z',
        'IMAGE_UPLOAD',
        0,
        false,
        '01J7EVJFS58YH6HSYNCDWJE4JW'
    ),
    (
        '01J7EVM272ZWY4C27FFA2P6QVM',
        'RETENTION_PERIOD',
        30,
        true,
        '01J7EVJFS58YH6HSYNCDWJE4JW'
    ),
    -- Essential
    (
        '01J7EVM6BG12G1GS6ES7NMBT4A',
        'WORD_COUNT',
        0,
        false,
        '01J7EVJNRPXY17SESDS7DY65Y1'
    ),
    (
        '01J7EVM9VGEGKMGT5NVA3AP1PZ',
        'IMAGE_UPLOAD',
        0,
        false,
        '01J7EVJNRPXY17SESDS7DY65Y1'
    ),
    (
        '01J7EVMFF5V5KVQZE6AJW2S9V8',
        'RETENTION_PERIOD',
        0,
        false,
        '01J7EVJNRPXY17SESDS7DY65Y1'
    );


CREATE TABLE tbl_subscription (
    user_id CHAR(26) NOT NULL,
    plan_offering_id CHAR(26) NOT NULL,
    canceled_at TIMESTAMPTZ DEFAULT NULL,
    cancellation_reason SMALLINT DEFAULT NULL,
    CONSTRAINT pk__subscription PRIMARY KEY (user_id),
    CONSTRAINT fk__subscription__user FOREIGN KEY (user_id) REFERENCES tbl_user(user_id) ON DELETE CASCADE,
    CONSTRAINT fk__subscription__plan_offering FOREIGN KEY (plan_offering_id) REFERENCES tbl_plan_offering(plan_offering_id) ON DELETE CASCADE
);
