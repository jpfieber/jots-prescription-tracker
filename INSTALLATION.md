# Installation Guide

## Quick Installation (Recommended)

1. **Build the Plugin**
   ```bash
   npm run build
   ```
   This builds the plugin and automatically creates a `dist` folder with all the files you need.

2. **Copy to Obsidian**
   - Navigate to your Obsidian vault folder
   - Go to `.obsidian/plugins/`
   - Create a new folder called `prescription-tracker`
   - Copy all files from the `dist` folder to `prescription-tracker`

3. **Enable the Plugin**
   - Restart Obsidian
   - Go to Settings > Community Plugins
   - Find "Prescription Tracker" and enable it

## Alternative: Manual Build

1. **Build the Plugin**
   ```bash
   npm run build
   ```

2. **Copy Plugin Files to Obsidian**
   Copy these files to your Obsidian vault's plugin folder:
   ```
   .obsidian/plugins/prescription-tracker/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```

3. **Enable the Plugin**
   - Open Obsidian Settings
   - Go to Community Plugins
   - Find "Prescription Tracker" and enable it

## Manual Installation Steps

1. **Locate Your Vault's Plugin Folder**
   - Open your Obsidian vault folder
   - Navigate to `.obsidian/plugins/`
   - Create a new folder called `prescription-tracker`

2. **Copy Built Files**
   - Copy `main.js`, `manifest.json`, and `styles.css` from this project
   - Paste them into the `prescription-tracker` folder

3. **Restart Obsidian**
   - Restart Obsidian completely
   - Go to Settings > Community Plugins
   - Enable "Prescription Tracker"

## Usage

Once installed:
- Use the ribbon icon (pill icon) to add a new prescription
- Or use Command Palette: "Add new prescription"
- Configure storage location in Settings > Prescription Tracker

## Troubleshooting

- **Plugin not showing up**: Make sure the files are in the correct folder and Obsidian is restarted
- **Build errors**: Run `npm install` and then `npm run build`
- **Permission errors**: Make sure you have write access to your vault folder
