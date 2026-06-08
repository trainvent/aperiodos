.PHONY: dev dev-sandbox build deploy install

dev:
	cd web && npm run dev

dev-sandbox:
	cd web && npm run dev -- --sandbox

build:
	cd web && npm run build

deploy:
	./deploy.sh

install:
	cd web && npm install
