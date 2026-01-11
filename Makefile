.PHONY: help install test build clean publish dry-run version

# Variables
NPM := npm
PNPM := pnpm

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	$(PNPM) install

test: ## Run tests
	$(PNPM) test

build: clean ## Build the package
	$(PNPM) run build
	@echo "✅ Build complete! Files ready for publishing:"
	@ls -la | grep -E "(adapter|link|types)"

clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	rimraf dist adapter link types

dry-run: build ## Dry-run to see what files will be published
	@echo "📦 Files that will be included in the package:"
	$(NPM) pack --dry-run

version: ## Show current package version
	@node -p "require('./package.json').version"

publish: build ## Publish to npm (requires OTP)
	@echo "📦 Publishing trpc-extension..."
	@echo "⚠️  You will need your 2FA code from your authenticator app"
	@read -p "Enter OTP code: " otp; \
	$(NPM) publish --otp=$$otp

publish-no-otp: build ## Publish to npm without OTP (if 2FA is disabled)
	@echo "📦 Publishing trpc-extension..."
	$(NPM) publish

patch: ## Bump patch version (1.2.3 -> 1.2.4)
	$(NPM) version patch
	@echo "✅ Version bumped to $$(node -p 'require("./package.json").version')"

minor: ## Bump minor version (1.2.3 -> 1.3.0)
	$(NPM) version minor
	@echo "✅ Version bumped to $$(node -p 'require("./package.json").version')"

major: ## Bump major version (1.2.3 -> 2.0.0)
	$(NPM) version major
	@echo "✅ Version bumped to $$(node -p 'require("./package.json").version')"

release: test build publish ## Full release: test, build, and publish

quick-release: build publish ## Quick release: build and publish (skip tests)
