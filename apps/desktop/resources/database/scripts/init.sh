set -e

USERNAME="$1"
CWD="$(pwd)"

if [[ "$CWD" == *"database" ]]
then
    CWD="$(echo "$CWD" | sed "s:/database/scripts::")"
fi


export CLOUDY_CLIP_DATABASE_NAME=cloudy-clip-db

go run "$CWD/resources/database/jet/jet.go"
