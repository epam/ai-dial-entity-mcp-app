IMAGE ?= ai-dial-entity-mcp-app
PORT ?= 8080

.PHONY: docker-build docker-run

docker-build:
	docker build -t $(IMAGE) .

docker-run:
	docker run --rm -p $(PORT):8080 --read-only --tmpfs /tmp $(IMAGE)

SERVER_IMAGE ?= ai-dial-entity-mcp

.PHONY: server-build server-run

server-build:
	docker build -f servers/entity-mcp/Dockerfile -t $(SERVER_IMAGE) .

server-run:
	docker run --rm -p $(PORT):8080 -e DIAL_CORE_BASE_URL=$(DIAL_CORE_BASE_URL) \
		--read-only --tmpfs /tmp $(SERVER_IMAGE)
