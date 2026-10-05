IMAGE ?= ai-dial-entity-mcp-app
PORT ?= 8080

.PHONY: docker-build docker-run

docker-build:
	docker build -t $(IMAGE) .

docker-run:
	docker run --rm -p $(PORT):8080 --read-only --tmpfs /tmp $(IMAGE)
