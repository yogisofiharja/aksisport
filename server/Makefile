.PHONY: run build test vet migrate-up

run:
	go run ./cmd/api

build:
	go build -o bin/aksi-server ./cmd/api

test:
	go test ./...

vet:
	go vet ./...

migrate-up:
	go run ./cmd/migrate up
