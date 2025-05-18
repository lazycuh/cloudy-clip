set -e

USERNAME="$1"
CWD="$(pwd)"

if [[ $# -eq 0 ]]
then
    USERNAME="postgres"
fi

if [[ "$CWD" == *"database" ]]
then
    CWD="$(echo "$CWD" | sed "s:/database/scripts::")"
fi

psql -h localhost -p 9876 -U "$USERNAME" -f "$CWD/database/scripts/init.sql"

export TRADE_TIMELINE_DATABASE_HOST=localhost
export TRADE_TIMELINE_DATABASE_USERNAME=postgres
export TRADE_TIMELINE_DATABASE_PASSWORD=postgres
export TRADE_TIMELINE_DATABASE_PORT=9876
export TRADE_TIMELINE_DATABASE_NAME=cloudy-clip-db

node "$CWD/database/apply-migrations.js" "$TRADE_TIMELINE_DATABASE_NAME"
go run "$CWD/jet/jet.go"

$CWD/database/scripts/seed.sh
