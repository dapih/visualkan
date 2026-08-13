SKILL_NAME    := visual-explainer
SKILL_DIR     := skill
SKILL_FILE    := $(SKILL_DIR)/$(SKILL_NAME).md
METADATA_FILE := $(SKILL_DIR)/metadata.json
VERSION       := $(shell jq -r '.version' $(METADATA_FILE))

# Install paths
CLAUDE_COMMANDS_DIR    := $(HOME)/.claude/commands
OPENCLAW_SKILLS_DIR    ?= $(HOME)/clawd/skills

# Antigravity (Global: ~/.gemini/config/skills/, Project: .agents/skills/)
ANTIGRAVITY_SKILLS_DIR ?= $(HOME)/.gemini/config/skills

# Gemini CLI (Global: ~/.gemini/skills/, Project: .gemini/skills/)
GEMINI_SKILLS_DIR      ?= $(HOME)/.gemini/skills

# Codex CLI (Global: ~/.codex/skills/, Project: .codex/skills/)
CODEX_SKILLS_DIR       ?= $(HOME)/.codex/skills

# Open Agent Standard / Agents (Global: ~/.agents/skills/, Project: .agents/skills/)
# Supported by: ChatGPT desktop (including Codex desktop), Cursor, OpenCode, GitHub Copilot, Windsurf, Roo Code, Trae
AGENTS_SKILLS_DIR      ?= $(HOME)/.agents/skills

.PHONY: help install uninstall version check info \
	openclaw-install openclaw-uninstall openclaw-check \
	antigravity-install antigravity-uninstall antigravity-check \
	gemini-install gemini-uninstall gemini-check \
	codex-install codex-uninstall codex-check \
	agents-install agents-uninstall agents-check \
	project-install project-uninstall \
	bump-patch bump-minor bump-major set-version release

.DEFAULT_GOAL := help

help: ## Show this help
	@echo "$(SKILL_NAME) v$(VERSION)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Claude Code:"
	@grep -E '^(install|uninstall|check):' $(MAKEFILE_LIST) | grep '##' | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'
	@echo ""
	@echo "OpenClaw:"
	@grep -E '^openclaw-' $(MAKEFILE_LIST) | grep '##' | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'
	@echo ""
	@echo "Antigravity:"
	@grep -E '^antigravity-' $(MAKEFILE_LIST) | grep '##' | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'
	@echo ""
	@echo "Gemini CLI:"
	@grep -E '^gemini-' $(MAKEFILE_LIST) | grep '##' | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'
	@echo ""
	@echo "Codex CLI:"
	@grep -E '^codex-' $(MAKEFILE_LIST) | grep '##' | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'
	@echo ""
	@echo "Open Agent Standard (agentskills.io / Cursor / Copilot / ChatGPT desktop / OpenCode / Windsurf / Roo Code / Trae):"
	@grep -E '^agents-' $(MAKEFILE_LIST) | grep '##' | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'
	@echo ""
	@echo "Project Scope:"
	@grep -E '^project-' $(MAKEFILE_LIST) | grep '##' | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'
	@echo ""
	@echo "Version & Release:"
	@grep -E '^(version|info|bump-patch|bump-minor|bump-major|set-version|release):' $(MAKEFILE_LIST) | grep '##' | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'

# ============================================================================
# Claude Code
# ============================================================================

install: check ## Install skill to ~/.claude/commands/
	@mkdir -p $(CLAUDE_COMMANDS_DIR)
	@cp $(SKILL_FILE) $(CLAUDE_COMMANDS_DIR)/$(SKILL_NAME).md
	@echo "Installed $(SKILL_NAME) v$(VERSION) to $(CLAUDE_COMMANDS_DIR)/$(SKILL_NAME).md"

uninstall: ## Remove skill from ~/.claude/commands/
	@rm -f $(CLAUDE_COMMANDS_DIR)/$(SKILL_NAME).md
	@echo "Uninstalled $(SKILL_NAME) from $(CLAUDE_COMMANDS_DIR)"

version: ## Print current version
	@echo $(VERSION)

check: ## Verify skill files and dependencies
	@if [ ! -f $(SKILL_FILE) ]; then \
		echo "Error: $(SKILL_FILE) not found"; exit 1; \
	fi
	@if [ ! -f $(METADATA_FILE) ]; then \
		echo "Error: $(METADATA_FILE) not found"; exit 1; \
	fi
	@command -v jq >/dev/null 2>&1 || { echo "Error: jq is required (brew install jq)"; exit 1; }
	@if [ -z "$$OPENAI_API_KEY" ] && [ -z "$$GEMINI_API_KEY" ] && [ -z "$$OPENROUTER_API_KEY" ]; then \
		echo "Notice: No explicit API key found (OPENAI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY)."; \
		echo "        Antigravity & Codex users use native subscription image generation capability (no API key required)."; \
		echo "        For non-Antigravity/Codex users or custom OpenRouter models, set one of:"; \
		echo "          export OPENAI_API_KEY=\"sk-...\"       # from platform.openai.com"; \
		echo "          export GEMINI_API_KEY=\"AIza...\"      # from aistudio.google.com/apikey"; \
		echo "          export OPENROUTER_API_KEY=\"sk-or...\"  # from openrouter.ai/keys"; \
	else \
		echo "API Keys detected:"; \
		[ -n "$$OPENAI_API_KEY" ] && echo "  - OpenAI API Key: set"; \
		[ -n "$$GEMINI_API_KEY" ] && echo "  - Gemini API Key: set"; \
		[ -n "$$OPENROUTER_API_KEY" ] && echo "  - OpenRouter API Key: set"; \
	fi
	@echo "All checks passed"

info: ## Show skill metadata
	@echo "Name:        $(SKILL_NAME)"
	@echo "Version:     $(VERSION)"
	@echo "Author:      $(shell jq -r '.author.name' $(METADATA_FILE))"
	@echo "Description: $(shell jq -r '.description' $(METADATA_FILE))"
	@echo "Styles:      $(shell jq -r '.styles | join(", ")' $(METADATA_FILE))"

# ============================================================================
# OpenClaw
# ============================================================================

openclaw-install: check ## Install skill to ~/clawd/skills/
	@mkdir -p $(OPENCLAW_SKILLS_DIR)/$(SKILL_NAME)
	@cp $(SKILL_FILE) $(OPENCLAW_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md
	@cp $(METADATA_FILE) $(OPENCLAW_SKILLS_DIR)/$(SKILL_NAME)/metadata.json
	@echo "Installed $(SKILL_NAME) v$(VERSION) to $(OPENCLAW_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"

openclaw-uninstall: ## Remove skill from ~/clawd/skills/
	@if [ -d $(OPENCLAW_SKILLS_DIR)/$(SKILL_NAME) ]; then \
		rm -rf $(OPENCLAW_SKILLS_DIR)/$(SKILL_NAME); \
		echo "Uninstalled $(SKILL_NAME) from $(OPENCLAW_SKILLS_DIR)"; \
	else \
		echo "$(SKILL_NAME) not installed in OpenClaw"; \
	fi

openclaw-check: ## Check if skill is installed in OpenClaw
	@echo "OpenClaw Skill Status"
	@echo "====================="
	@echo "Skills directory: $(OPENCLAW_SKILLS_DIR)"
	@echo ""
	@if [ -f $(OPENCLAW_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md ]; then \
		echo "$(SKILL_NAME): INSTALLED"; \
		echo "  Location: $(OPENCLAW_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"; \
	else \
		echo "$(SKILL_NAME): NOT INSTALLED"; \
		echo "  Run: make openclaw-install"; \
	fi

# ============================================================================
# Antigravity
# ============================================================================

antigravity-install: check ## Install skill globally to ~/.gemini/config/skills/
	@mkdir -p $(ANTIGRAVITY_SKILLS_DIR)/$(SKILL_NAME)
	@cp $(SKILL_FILE) $(ANTIGRAVITY_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md
	@cp $(METADATA_FILE) $(ANTIGRAVITY_SKILLS_DIR)/$(SKILL_NAME)/metadata.json
	@echo "Installed $(SKILL_NAME) v$(VERSION) to $(ANTIGRAVITY_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"

antigravity-uninstall: ## Remove skill from ~/.gemini/config/skills/
	@if [ -d $(ANTIGRAVITY_SKILLS_DIR)/$(SKILL_NAME) ]; then \
		rm -rf $(ANTIGRAVITY_SKILLS_DIR)/$(SKILL_NAME); \
		echo "Uninstalled $(SKILL_NAME) from Antigravity ($(ANTIGRAVITY_SKILLS_DIR))"; \
	else \
		echo "$(SKILL_NAME) not installed in Antigravity global scope"; \
	fi

antigravity-check: ## Check if skill is installed in Antigravity
	@echo "Antigravity Skill Status"
	@echo "========================"
	@echo "Skills directory: $(ANTIGRAVITY_SKILLS_DIR)"
	@echo ""
	@if [ -f $(ANTIGRAVITY_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md ]; then \
		echo "$(SKILL_NAME): INSTALLED"; \
		echo "  Location: $(ANTIGRAVITY_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"; \
	else \
		echo "$(SKILL_NAME): NOT INSTALLED"; \
		echo "  Run: make antigravity-install"; \
	fi

# ============================================================================
# Gemini CLI
# ============================================================================

gemini-install: check ## Install skill globally to ~/.gemini/skills/
	@mkdir -p $(GEMINI_SKILLS_DIR)/$(SKILL_NAME)
	@cp $(SKILL_FILE) $(GEMINI_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md
	@cp $(METADATA_FILE) $(GEMINI_SKILLS_DIR)/$(SKILL_NAME)/metadata.json
	@echo "Installed $(SKILL_NAME) v$(VERSION) to $(GEMINI_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"

gemini-uninstall: ## Remove skill from ~/.gemini/skills/
	@if [ -d $(GEMINI_SKILLS_DIR)/$(SKILL_NAME) ]; then \
		rm -rf $(GEMINI_SKILLS_DIR)/$(SKILL_NAME); \
		echo "Uninstalled $(SKILL_NAME) from Gemini CLI ($(GEMINI_SKILLS_DIR))"; \
	else \
		echo "$(SKILL_NAME) not installed in Gemini CLI"; \
	fi

gemini-check: ## Check if skill is installed in Gemini CLI
	@echo "Gemini CLI Skill Status"
	@echo "======================="
	@echo "Skills directory: $(GEMINI_SKILLS_DIR)"
	@echo ""
	@if [ -f $(GEMINI_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md ]; then \
		echo "$(SKILL_NAME): INSTALLED"; \
		echo "  Location: $(GEMINI_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"; \
	else \
		echo "$(SKILL_NAME): NOT INSTALLED"; \
		echo "  Run: make gemini-install"; \
	fi

# ============================================================================
# Codex CLI
# ============================================================================

codex-install: check ## Install skill globally to ~/.codex/skills/
	@mkdir -p $(CODEX_SKILLS_DIR)/$(SKILL_NAME)
	@cp $(SKILL_FILE) $(CODEX_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md
	@cp $(METADATA_FILE) $(CODEX_SKILLS_DIR)/$(SKILL_NAME)/metadata.json
	@echo "Installed $(SKILL_NAME) v$(VERSION) to $(CODEX_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"

codex-uninstall: ## Remove skill from ~/.codex/skills/
	@if [ -d $(CODEX_SKILLS_DIR)/$(SKILL_NAME) ]; then \
		rm -rf $(CODEX_SKILLS_DIR)/$(SKILL_NAME); \
		echo "Uninstalled $(SKILL_NAME) from Codex CLI ($(CODEX_SKILLS_DIR))"; \
	else \
		echo "$(SKILL_NAME) not installed in Codex CLI"; \
	fi

codex-check: ## Check if skill is installed in Codex CLI
	@echo "Codex CLI Skill Status"
	@echo "======================"
	@echo "Skills directory: $(CODEX_SKILLS_DIR)"
	@echo ""
	@if [ -f $(CODEX_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md ]; then \
		echo "$(SKILL_NAME): INSTALLED"; \
		echo "  Location: $(CODEX_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"; \
	else \
		echo "$(SKILL_NAME): NOT INSTALLED"; \
		echo "  Run: make codex-install"; \
	fi

# ============================================================================
# Open Agent Standard / Agents (Cursor, Copilot, ChatGPT desktop, OpenCode, Windsurf, Roo Code, Trae)
# ============================================================================

agents-install: check ## Install skill globally to ~/.agents/skills/ (Open Agent Standard)
	@mkdir -p $(AGENTS_SKILLS_DIR)/$(SKILL_NAME)
	@cp $(SKILL_FILE) $(AGENTS_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md
	@cp $(METADATA_FILE) $(AGENTS_SKILLS_DIR)/$(SKILL_NAME)/metadata.json
	@echo "Installed $(SKILL_NAME) v$(VERSION) to $(AGENTS_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"

agents-uninstall: ## Remove skill from ~/.agents/skills/
	@if [ -d $(AGENTS_SKILLS_DIR)/$(SKILL_NAME) ]; then \
		rm -rf $(AGENTS_SKILLS_DIR)/$(SKILL_NAME); \
		echo "Uninstalled $(SKILL_NAME) from Open Agent Standard ($(AGENTS_SKILLS_DIR))"; \
	else \
		echo "$(SKILL_NAME) not installed in Open Agent Standard global scope"; \
	fi

agents-check: ## Check if skill is installed in ~/.agents/skills/
	@echo "Open Agent Standard Skill Status"
	@echo "================================"
	@echo "Skills directory: $(AGENTS_SKILLS_DIR)"
	@echo ""
	@if [ -f $(AGENTS_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md ]; then \
		echo "$(SKILL_NAME): INSTALLED"; \
		echo "  Location: $(AGENTS_SKILLS_DIR)/$(SKILL_NAME)/SKILL.md"; \
	else \
		echo "$(SKILL_NAME): NOT INSTALLED"; \
		echo "  Run: make agents-install"; \
	fi

# ============================================================================
# Project Scope Installation (PROJECT_DIR=/absolute/path/to/target-project)
# ============================================================================

PROJECT_DIR ?= .

project-install: check ## Install skill to target project scope (.agents/skills/) — pass PROJECT_DIR=/path/to/target-project
	@if [ "$(PROJECT_DIR)" = "." ]; then \
		echo "Notice: Installing to current directory ./.agents/skills/$(SKILL_NAME)"; \
		echo "        To install to a specific project, pass PROJECT_DIR=/absolute/path/to/target-project"; \
	fi
	@mkdir -p $(PROJECT_DIR)/.agents/skills/$(SKILL_NAME)
	@cp $(SKILL_FILE) $(PROJECT_DIR)/.agents/skills/$(SKILL_NAME)/SKILL.md
	@cp $(METADATA_FILE) $(PROJECT_DIR)/.agents/skills/$(SKILL_NAME)/metadata.json
	@echo "Installed $(SKILL_NAME) v$(VERSION) to $(PROJECT_DIR)/.agents/skills/$(SKILL_NAME)/SKILL.md"

project-uninstall: ## Remove skill from target project scope (.agents/skills/) — pass PROJECT_DIR=/path/to/target-project
	@if [ -d $(PROJECT_DIR)/.agents/skills/$(SKILL_NAME) ]; then \
		rm -rf $(PROJECT_DIR)/.agents/skills/$(SKILL_NAME); \
		echo "Uninstalled $(SKILL_NAME) from $(PROJECT_DIR)/.agents/skills/"; \
	else \
		echo "$(SKILL_NAME) not installed in $(PROJECT_DIR)/.agents/skills/"; \
	fi

gemini-project-install: check ## Install skill to Gemini CLI project scope (.gemini/skills/) — pass PROJECT_DIR=/path/to/target-project
	@mkdir -p $(PROJECT_DIR)/.gemini/skills/$(SKILL_NAME)
	@cp $(SKILL_FILE) $(PROJECT_DIR)/.gemini/skills/$(SKILL_NAME)/SKILL.md
	@cp $(METADATA_FILE) $(PROJECT_DIR)/.gemini/skills/$(SKILL_NAME)/metadata.json
	@echo "Installed $(SKILL_NAME) v$(VERSION) to $(PROJECT_DIR)/.gemini/skills/$(SKILL_NAME)/SKILL.md"

codex-project-install: check ## Install skill to Codex CLI project scope (.codex/skills/) — pass PROJECT_DIR=/path/to/target-project
	@mkdir -p $(PROJECT_DIR)/.codex/skills/$(SKILL_NAME)
	@cp $(SKILL_FILE) $(PROJECT_DIR)/.codex/skills/$(SKILL_NAME)/SKILL.md
	@cp $(METADATA_FILE) $(PROJECT_DIR)/.codex/skills/$(SKILL_NAME)/metadata.json
	@echo "Installed $(SKILL_NAME) v$(VERSION) to $(PROJECT_DIR)/.codex/skills/$(SKILL_NAME)/SKILL.md"

# --- Version management ---

bump-patch: ## Bump patch version (x.y.Z)
	@NEW_VERSION=$$(echo $(VERSION) | awk -F. '{print $$1"."$$2"."$$3+1}'); \
	jq --arg v "$$NEW_VERSION" '.version = $$v | .updated = (now | strftime("%Y-%m-%d"))' $(METADATA_FILE) > $(METADATA_FILE).tmp && \
	mv $(METADATA_FILE).tmp $(METADATA_FILE); \
	echo "Bumped version: $(VERSION) → $$NEW_VERSION"

bump-minor: ## Bump minor version (x.Y.0)
	@NEW_VERSION=$$(echo $(VERSION) | awk -F. '{print $$1"."$$2+1".0"}'); \
	jq --arg v "$$NEW_VERSION" '.version = $$v | .updated = (now | strftime("%Y-%m-%d"))' $(METADATA_FILE) > $(METADATA_FILE).tmp && \
	mv $(METADATA_FILE).tmp $(METADATA_FILE); \
	echo "Bumped version: $(VERSION) → $$NEW_VERSION"

bump-major: ## Bump major version (X.0.0)
	@NEW_VERSION=$$(echo $(VERSION) | awk -F. '{print $$1+1".0.0"}'); \
	jq --arg v "$$NEW_VERSION" '.version = $$v | .updated = (now | strftime("%Y-%m-%d"))' $(METADATA_FILE) > $(METADATA_FILE).tmp && \
	mv $(METADATA_FILE).tmp $(METADATA_FILE); \
	echo "Bumped version: $(VERSION) → $$NEW_VERSION"

set-version: ## Set version (make set-version V=1.2.3)
	@if [ -z "$(V)" ]; then echo "Usage: make set-version V=1.2.3"; exit 1; fi
	@echo $(V) | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$$' || { echo "Error: version must be semver (e.g., 1.2.3)"; exit 1; }
	@jq --arg v "$(V)" '.version = $$v | .updated = (now | strftime("%Y-%m-%d"))' $(METADATA_FILE) > $(METADATA_FILE).tmp && \
	mv $(METADATA_FILE).tmp $(METADATA_FILE)
	@echo "Set version: $(VERSION) → $(V)"

release: check ## Tag and commit a release
	@echo "Releasing $(SKILL_NAME) v$(VERSION)..."
	@git add $(METADATA_FILE) $(SKILL_FILE)
	@git commit -m "Release v$(VERSION)"
	@git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	@echo "Created commit and tag v$(VERSION)"
	@echo "Run 'git push && git push --tags' to publish"
