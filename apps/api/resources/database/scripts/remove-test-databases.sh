USERNAME="$1"
CWD="$(pwd)"

if [[ $# -eq 0 ]]
then
    USERNAME="postgres"
fi

psql -h localhost -p 9876 -U "$USERNAME" -c "copy (SELECT datname FROM pg_database WHERE datname LIKE 'testdb%_inst_%') to stdout" | while read line; do
    echo "Dropping database $line"
    dropdb -h localhost -p 9876 -U "$USERNAME" "$line"
done