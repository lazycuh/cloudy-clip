DROP DATABASE IF EXISTS "cloudy-clip-db";
DROP ROLE IF EXISTS "cloudy-clip-user";

CREATE ROLE "cloudy-clip-user" SUPERUSER CREATEDB LOGIN PASSWORD 'unsecured';
CREATE DATABASE "cloudy-clip-db" OWNER 'cloudy-clip-user';
