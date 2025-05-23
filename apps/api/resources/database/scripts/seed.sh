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

psql -h localhost -p 9876 -U "$USERNAME" -f "$CWD/database/scripts/users.sql"
