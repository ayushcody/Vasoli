.PHONY: dev web backend proto sqlc check

dev:
	@echo "Starting both Next.js and Go backend concurrently..."
	@make -j 2 web backend

web:
	npm run dev

backend:
	npm run backend:dev

proto:
	npm run proto:gen

sqlc:
	npm run sqlc:gen

check:
	npm run check
