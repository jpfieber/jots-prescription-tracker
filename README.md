# Prescription Tracker - Obsidian Plugin

An Obsidi5. **Manage Pharmacies**:
   - Add pharmacies to your personal list
   - Remove pharmacies you no longer use
   - Pharmacies appear as dropdown options in the modal
6. **Manage Patients**:
   - Add patients to your personal list
   - Remove patients you no longer need
   - Patients appear as dropdown options in the modal
7. **People Notes Integration**:
   - Set the folder containing your people notes
   - Specify the property name for relationships (e.g., "relationship", "role")
   - Set the value that identifies prescribing doctors (e.g., "doctor")
   - Doctors from your people notes will appear in the "Prescribed by" dropdown
8. Folders will be created automatically if they don't existugin that helps you track medical prescriptions with structured notes and YAML frontmatter. Perfect for organizing your healthcare information in your personal knowledge base.

## Features

- **📋 Easy Prescription Entry**: Use a simple modal form to input prescription details
- **📝 Structured Notes**: Automatically creates notes with comprehensive YAML frontmatter
- **⚙️ Configurable Storage**: Choose where your prescription notes are stored
- **📅 Date Organization**: Organize notes by date with customizable folder structures
- **🏥 Comprehensive Tracking**: Track medications, dosages, refills, side effects, and more
- **� People Notes Integration**: Automatically populate prescribing doctors from your people notes
- **🔗 Smart Linking**: Creates links to doctor notes when selected from dropdown
- **💊 Pharmacy Management**: Configure and manage your preferred pharmacies
- **�📱 Mobile Compatible**: Works on both desktop and mobile versions of Obsidian

## How to Use

### Adding a New Prescription

1. **Command Palette**: Press `Ctrl+P` (or `Cmd+P` on Mac) and type "Add new prescription"
2. **Ribbon Icon**: Click the pill icon in the left ribbon
3. **Fill out the form** with prescription details:
   - Medication name
   - Prescription fill date
   - Prescription obtained date
   - Pharmacy (dropdown with your configured pharmacies)
   - Prescription number
   - Dose
   - Days supply
   - Quantity dispensed
   - Copay
   - Manufacturer
   - Patient
   - Drug label (select from +Inbox folder)
   - Substituted
   - Frequency
   - Prescribed by (dropdown with doctors from your people notes, or manual entry)
   - Refills remaining
   - Special instructions
   - Additional notes

4. **Click "Create Note"** to generate a structured prescription note

### Configuring Settings

1. Go to **Settings > Community Plugins > Prescription Tracker**
2. Set the **Prescription Folder** where notes will be stored
3. Configure **Date Organization** format (default: `YYYY/YYYY-MM`)
   - `YYYY/YYYY-MM` → `2025/2025-08` (recommended)
   - `YYYY/MM` → `2025/08`
   - `YYYY-MM` → `2025-08` (no year folder)
   - `YYYY/MM/DD` → `2025/08/03` (daily folders)
4. **Manage Pharmacies**:
   - Add pharmacies to your personal list
   - Remove pharmacies you no longer use
   - Pharmacies appear as dropdown options in the modal
5. Folders will be created automatically if they don't exist

## Note Structure

Each prescription note is organized by date and includes:

### File Organization
Notes are automatically organized using the configured date format:
- Default: `Prescriptions/2025/2025-08/20250803 - Rx6298009 -- Progesterone 100MG.md`
- With daily folders: `Prescriptions/2025/08/03/20250803 - Rx6298009 -- Progesterone 100MG.md`

### YAML Frontmatter
```yaml
---
fileClass: Prescriptions
filename: 20250803 - Rx6298009 -- Progesterone 100MG.md
created: 2025-08-03T10:30:00.000Z
rxNum: "6298009"
medication: Progesterone
diagnosis: 
pharmacy: CVS Pharmacy
prescriber: Dr. Smith
qtyWrit: 
qtyDisp: 30 capsules
refills: 5
dose: 100MG
dateWritten: 
dateFilled: 2025-08-03
dateObtained: 2025-08-01
copay: $15.00
mfg: Pfizer
patient: John Doe
drugLabel: +Inbox/prescription-label-scan.pdf
substituted: 
daySupply: 30
dateFinished: 2025-08-31
---
```

**Notes**: 
- `dateFinished` is automatically calculated by adding the `daySupply` to the `dateObtained` date.
- `drugLabel` can be selected from files in the `+Inbox` folder via dropdown.
- `prescriber` will contain a link to the doctor's note when selected from the dropdown (e.g., `[[Dr. John Smith]]`).

### People Notes Format
For the prescriber dropdown to work, your people notes should have YAML frontmatter like:
```yaml
---
name: Dr. John Smith
relationship: doctor
# ... other properties
---
```

The plugin will scan your people folder for notes where the relationship property matches your configured doctor value.

### Note Content
- Prescription details summary
- Instructions section
- Notes section
- Refill history tracking
- Side effects tracking

## Development

### Prerequisites
- Node.js and npm
- TypeScript knowledge
- Obsidian for testing

### Setup
```bash
# Clone or download this repository
cd jots-prescription-tracker

# Install dependencies
npm install

# Start development build (watches for changes)
npm run dev

# Build for production (automatically creates dist folder)
npm run build
```

### Testing
1. Build the plugin using `npm run build` (this automatically creates the dist folder)
2. Copy all files from the `dist` folder to your Obsidian vault's `.obsidian/plugins/prescription-tracker/` folder
3. Enable the plugin in Obsidian settings

## Installation

### From Obsidian Community Plugins (Future)
1. Open Obsidian Settings
2. Go to Community Plugins
3. Search for "Prescription Tracker"
4. Install and enable

### Manual Installation
1. Download the latest release or build from source using `npm run build`
2. Copy all files from the `dist` folder to `.obsidian/plugins/prescription-tracker/` in your vault
3. Enable the plugin in Community Plugins settings

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

If you find this plugin helpful, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs or requesting features
- 💡 Contributing improvements

## Disclaimer

This plugin is for organizational purposes only and should not replace professional medical advice. Always consult with healthcare professionals for medical decisions.
