.PHONY: run build test test-db vet migrate-up

run:
	go run ./cmd/api

build:
	go build -o bin/aksi-server ./cmd/api

test:
	go test ./...

# Database tests too, each package in its own throwaway schema inside the
# dev database (internal/testdb), dropped afterwards. Uses .env's DATABASE_URL.
test-db:
	TEST_DATABASE_URL="$$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)" go test -count=1 ./...

vet:
	go vet ./...

migrate-up:
	go run ./cmd/migrate up
