-- compose가 Postgres를 처음 초기화할 때 한 번 실행한다. 둘 다 template1에서 만들어져 비어 있고,
-- PostGIS 확장은 Prisma 마이그레이션이 설치한다.
CREATE DATABASE app;
CREATE DATABASE app_test;
