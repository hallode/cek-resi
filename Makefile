.PHONY: run test vet fmt reset-db

run:
	go run .

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

reset-db:
	rm -f cekresi.db
