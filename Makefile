# BlitzQuotes Makefile
# Run `make help` to see all available commands

.PHONY: help dev deploy-all deploy-functions deploy-ai deploy-quote-view deploy-quote-page db-push db-reset db-migrate logs-ai logs-quote-view

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)BlitzQuotes Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ============================================================================
# Development
# ============================================================================

dev: ## Start Expo development server
	npx expo start

dev-ios: ## Start Expo and open iOS simulator
	npx expo start --ios

dev-android: ## Start Expo and open Android emulator
	npx expo start --android

dev-clear: ## Start Expo with cache cleared
	npx expo start --clear

# ============================================================================
# Supabase Functions
# ============================================================================

deploy-functions: deploy-ai deploy-quote-view ## Deploy all Supabase edge functions
	@echo "$(GREEN)All functions deployed!$(NC)"

deploy-ai: ## Deploy the AI edge function
	@echo "$(BLUE)Deploying AI function...$(NC)"
	supabase functions deploy ai
	@echo "$(GREEN)AI function deployed!$(NC)"

deploy-quote-view: ## Deploy the quote-view edge function (public)
	@echo "$(BLUE)Deploying quote-view function...$(NC)"
	supabase functions deploy quote-view --no-verify-jwt
	@echo "$(GREEN)quote-view function deployed!$(NC)"

logs-ai: ## Tail logs for AI function
	supabase functions logs ai --tail

logs-quote-view: ## Tail logs for quote-view function
	supabase functions logs quote-view --tail

# ============================================================================
# Cloudflare Pages (Quote Page)
# ============================================================================

deploy-quote-page: ## Deploy quote page to Cloudflare Pages
	@echo "$(BLUE)Deploying quote page to Cloudflare...$(NC)"
	npx wrangler pages deploy ./quote-page --project-name=blitzquotes-quote
	@echo "$(GREEN)Quote page deployed!$(NC)"
	@echo "$(YELLOW)Remember to set up custom domain q.blitzquotes.com in Cloudflare dashboard$(NC)"

# ============================================================================
# Database
# ============================================================================

db-push: ## Push local migrations to remote database
	@echo "$(BLUE)Pushing database migrations...$(NC)"
	supabase db push
	@echo "$(GREEN)Database updated!$(NC)"

db-reset: ## Reset local database (WARNING: destroys local data)
	@echo "$(YELLOW)WARNING: This will reset your local database!$(NC)"
	supabase db reset

db-diff: ## Generate migration from local schema changes
	supabase db diff -f $(name)

db-migrate: ## Create a new migration file
	@if [ -z "$(name)" ]; then \
		echo "$(YELLOW)Usage: make db-migrate name=migration_name$(NC)"; \
	else \
		supabase migration new $(name); \
	fi

db-status: ## Show migration status
	supabase migration list

# ============================================================================
# Full Deployments
# ============================================================================

deploy-all: deploy-functions deploy-quote-page db-push ## Deploy everything (functions, quote page, database)
	@echo "$(GREEN)======================================$(NC)"
	@echo "$(GREEN)All deployments complete!$(NC)"
	@echo "$(GREEN)======================================$(NC)"

deploy-backend: deploy-functions db-push ## Deploy backend only (functions + database)
	@echo "$(GREEN)Backend deployed!$(NC)"

# ============================================================================
# Build & Release
# ============================================================================

build-ios: ## Build iOS app with EAS
	eas build --platform ios

build-android: ## Build Android app with EAS
	eas build --platform android

build-all: ## Build both iOS and Android
	eas build --platform all

submit-ios: ## Submit iOS build to App Store
	eas submit --platform ios

submit-android: ## Submit Android build to Play Store
	eas submit --platform android

# ============================================================================
# Utilities
# ============================================================================

typecheck: ## Run TypeScript type checking
	npx tsc --noEmit

lint: ## Run ESLint
	npx eslint . --ext .ts,.tsx

test: ## Run tests
	npm test

clean: ## Clean build artifacts and caches
	rm -rf node_modules/.cache
	rm -rf .expo
	@echo "$(GREEN)Cache cleaned!$(NC)"

install: ## Install dependencies
	npm install

# ============================================================================
# Secrets & Environment
# ============================================================================

secrets-list: ## List all Supabase secrets
	supabase secrets list

secrets-set: ## Set a Supabase secret (usage: make secrets-set name=KEY value=VALUE)
	@if [ -z "$(name)" ] || [ -z "$(value)" ]; then \
		echo "$(YELLOW)Usage: make secrets-set name=KEY value=VALUE$(NC)"; \
	else \
		supabase secrets set $(name)=$(value); \
	fi
