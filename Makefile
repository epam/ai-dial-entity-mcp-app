IMAGE ?= ai-dial-skill-mcp-app-frontend
PORT ?= 8080

.PHONY: docker-build docker-run

docker-build:
	docker build -t $(IMAGE) .

docker-run:
	docker run --rm -p $(PORT):8080 --read-only --tmpfs /tmp $(IMAGE)
