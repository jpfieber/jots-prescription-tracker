<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Prescription Tracker Obsidian Plugin

This is an Obsidian plugin project for tracking medical prescriptions. The plugin:

1. Provides a command and ribbon button to open a modal for entering prescription data
2. Creates structured notes with YAML frontmatter containing prescription information
3. Includes a settings tab for configuring where prescription notes are stored
4. Uses the Obsidian API for folder operations and UI components

## Key Features
- Modal form for entering prescription details (medication name, dosage, frequency, etc.)
- Automatic note creation with comprehensive YAML frontmatter
- Configurable storage location in plugin settings
- Structured note template with sections for tracking refills and side effects

## Architecture
- `main.ts`: Main plugin class with modal and settings components
- `manifest.json`: Plugin metadata and requirements
- Build system using esbuild for TypeScript compilation

When working on this project, ensure:
- Use Obsidian API components (Modal, Setting, Notice, etc.)
- Follow Obsidian plugin best practices
- Maintain TypeScript type safety
- Consider mobile compatibility (isDesktopOnly: false)
