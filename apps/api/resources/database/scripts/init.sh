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

export CLOUDY_CLIP_DATABASE_HOST=localhost
export CLOUDY_CLIP_DATABASE_USERNAME=postgres
export CLOUDY_CLIP_DATABASE_PASSWORD=postgres
export CLOUDY_CLIP_DATABASE_PORT=9876
export CLOUDY_CLIP_DATABASE_NAME=cloudy-clip-db

node "$CWD/database/apply-migrations.js" "$CLOUDY_CLIP_DATABASE_NAME"
go run "$CWD/database/jet/jet.go"

$CWD/database/scripts/seed.sh
