import { App, Editor, MarkdownView, Modal, Notice, Plugin, Setting, TFile, TFolder, TextComponent, normalizePath } from 'obsidian';
import moment from 'moment';
import { PrescriptionTrackerSettingTab } from './settings';
import { generateMedicationNote, searchMedications } from './generateMedNote';

// Date organization helper functions
function createDatePlaceholders(momentDate: moment.Moment) {
	return {
		'YYYY': momentDate.format('YYYY'),
		'YY': momentDate.format('YY'),
		'MMMM': momentDate.format('MMMM'),
		'MMM': momentDate.format('MMM'),
		'MM': momentDate.format('MM'),
		'M': momentDate.format('M'),
		'DDDD': momentDate.format('dddd'),
		'DDD': momentDate.format('ddd'),
		'DD': momentDate.format('DD'),
		'D': momentDate.format('D')
	};
}

function replacePlaceholders(str: string, placeholders: Record<string, string | number>): string {
	return str.replace(/YYYY|YY|MMMM|MMM|MM|M|DDDD|DDD|DD|D/g,
		(match: string) => String(placeholders[match] || match)
	);
}

function getDateBasedPath(dateStr: string, baseFolder: string, dateOrganization: string): string {
	const momentDate = moment(dateStr);
	const placeholders = createDatePlaceholders(momentDate);
	const subFolder = replacePlaceholders(dateOrganization, placeholders);
	return normalizePath(`${baseFolder}/${subFolder}`);
}

// Remember to rename these classes and interfaces!

interface PrescriptionData {
	medicationName: string;
	fillDate: string;
	obtainedDate: string;
	pharmacy: string;
	prescriptionNumber: string;
	dosage: string;
	daysSupply: number;
	quantityDispensed: string;
	copay: string;
	manufacturer: string;
	patient: string;
	frequency: string;
	prescribedBy: string;
	instructions: string;
	refillsRemaining: number;
	notes: string;
	diagnosis: string;
	quantityWritten: string;
	dateWritten: string;
	drugLabel: string;
	substituted: string;
	dateFinished: string;
}

interface PrescriptionTrackerSettings {
	prescriptionFolder: string;
	dateOrganization: string;
	pharmacyList: string[];
	peopleFolder: string;
	relationshipProperty: string;
	doctorRelationshipValue: string;
	medicationsFolder: string;
	diagnosisFolder: string;
	selectedPatientNotes: string[];
}

const DEFAULT_SETTINGS: PrescriptionTrackerSettings = {
	prescriptionFolder: 'Prescriptions',
	dateOrganization: 'YYYY/YYYY-MM',
	pharmacyList: ['CVS Pharmacy', 'Walgreens', 'Rite Aid'],
	peopleFolder: 'People',
	relationshipProperty: 'relationship',
	doctorRelationshipValue: 'doctor',
	medicationsFolder: 'Medications',
	diagnosisFolder: 'Diagnosis',
	selectedPatientNotes: []
}

export default class PrescriptionTrackerPlugin extends Plugin {
	settings: PrescriptionTrackerSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('pill', 'Add Prescription', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new PrescriptionModal(this.app, this).open();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('prescription-tracker-ribbon-class');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'add-prescription',
			name: 'Add new prescription',
			callback: () => {
				new PrescriptionModal(this.app, this).open();
			}
		});

		// Command to create a new medication note
		this.addCommand({
			id: 'create-medication-note',
			name: 'Create medication note',
			callback: () => {
				this.promptForMedicationName();
			}
		});

		// Command to convert current file to new medication structure
		this.addCommand({
			id: 'convert-medication-note',
			name: 'Convert current file to new medication structure',
			callback: () => {
				this.convertCurrentMedicationNote();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new PrescriptionTrackerSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async getDoctorsFromPeopleNotes(): Promise<{ name: string; link: string }[]> {
		const doctors: { name: string; link: string }[] = [];

		console.log('Looking for people folder:', this.settings.peopleFolder); // Debug log

		// Get the people folder
		const peopleFolder = this.app.vault.getAbstractFileByPath(this.settings.peopleFolder);
		if (!peopleFolder || !(peopleFolder instanceof TFolder)) {
			console.log('People folder not found or not a folder'); // Debug log
			return doctors;
		}

		console.log('People folder found, scanning files...'); // Debug log

		// Scan all markdown files in the people folder
		const files = this.app.vault.getMarkdownFiles().filter(file =>
			file.path.startsWith(this.settings.peopleFolder + '/')
		);

		console.log('Found files in people folder:', files.length); // Debug log

		for (const file of files) {
			try {
				const content = await this.app.vault.read(file);
				const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

				console.log(`Checking file ${file.path}, frontmatter:`, frontmatter); // Debug log

				if (frontmatter && frontmatter[this.settings.relationshipProperty]) {
					const relationshipValue = frontmatter[this.settings.relationshipProperty];
					let isDoctor = false;

					// Handle both string and array properties
					if (Array.isArray(relationshipValue)) {
						// If it's an array, check if it contains the doctor value
						isDoctor = relationshipValue.includes(this.settings.doctorRelationshipValue);
						console.log(`Array property: ${relationshipValue}, contains '${this.settings.doctorRelationshipValue}': ${isDoctor}`);
					} else if (typeof relationshipValue === 'string') {
						// If it's a string, check for exact match
						isDoctor = relationshipValue === this.settings.doctorRelationshipValue;
						console.log(`String property: '${relationshipValue}', matches '${this.settings.doctorRelationshipValue}': ${isDoctor}`);
					}

					if (isDoctor) {
						const displayName = frontmatter.name || file.basename;
						doctors.push({
							name: displayName,
							link: `[[${file.basename}]]`
						});
						console.log(`Added doctor: ${displayName}`); // Debug log
					}
				} else {
					console.log(`File ${file.path} has no '${this.settings.relationshipProperty}' property`); // Debug log
				}
			} catch (error) {
				console.warn('Error reading file:', file.path, error);
			}
		}

		console.log('Total doctors found:', doctors.length); // Debug log
		return doctors.sort((a, b) => a.name.localeCompare(b.name));
	}

	async getPatientsFromPeopleNotes(): Promise<{ name: string; link: string }[]> {
		const patients: { name: string; link: string }[] = [];

		// Only return selected patient notes from settings
		for (const selectedPatient of this.settings.selectedPatientNotes) {
			const file = this.app.vault.getAbstractFileByPath(`${this.settings.peopleFolder}/${selectedPatient}.md`);

			if (file && file instanceof TFile) {
				try {
					const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
					const displayName = frontmatter?.name || selectedPatient;
					patients.push({
						name: displayName,
						link: `[[${selectedPatient}]]`
					});
				} catch (error) {
					console.warn('Error reading selected patient file:', selectedPatient, error);
				}
			}
		}

		return patients.sort((a, b) => a.name.localeCompare(b.name));
	}

	async getMedicationsFromFolder(): Promise<{ name: string; link: string }[]> {
		const medications: { name: string; link: string }[] = [];

		console.log('Looking for medications folder:', this.settings.medicationsFolder); // Debug log

		// Get the medications folder
		const medicationsFolder = this.app.vault.getAbstractFileByPath(this.settings.medicationsFolder);
		if (!medicationsFolder || !(medicationsFolder instanceof TFolder)) {
			console.log('Medications folder not found or not a folder'); // Debug log
			return medications;
		}

		console.log('Medications folder found, scanning files...'); // Debug log

		// Scan all markdown files in the medications folder
		const files = this.app.vault.getMarkdownFiles().filter(file =>
			file.path.startsWith(this.settings.medicationsFolder + '/')
		);

		console.log('Found files in medications folder:', files.length); // Debug log

		for (const file of files) {
			try {
				// Use file basename as display name and create link
				const displayName = file.basename;
				medications.push({
					name: displayName,
					link: `[[${file.basename}]]`
				});
				console.log(`Added medication: ${displayName}`); // Debug log
			} catch (error) {
				console.warn('Error processing file:', file.path, error);
			}
		}

		console.log('Total medications found:', medications.length); // Debug log
		return medications.sort((a, b) => a.name.localeCompare(b.name));
	}

	async getDiagnosesFromFolder(): Promise<{ name: string; link: string }[]> {
		const diagnoses: { name: string; link: string }[] = [];

		console.log('Looking for diagnosis folder:', this.settings.diagnosisFolder); // Debug log

		// Get the diagnosis folder
		const diagnosisFolder = this.app.vault.getAbstractFileByPath(this.settings.diagnosisFolder);
		if (!diagnosisFolder || !(diagnosisFolder instanceof TFolder)) {
			console.log('Diagnosis folder not found or not a folder'); // Debug log
			return diagnoses;
		}

		console.log('Diagnosis folder found, scanning files...'); // Debug log

		// Scan all markdown files in the diagnosis folder
		const files = this.app.vault.getMarkdownFiles().filter(file =>
			file.path.startsWith(this.settings.diagnosisFolder + '/')
		);

		console.log('Found files in diagnosis folder:', files.length); // Debug log

		for (const file of files) {
			try {
				// Use file basename as display name and create link
				const displayName = file.basename;
				diagnoses.push({
					name: displayName,
					link: `[[${file.basename}]]`
				});
				console.log(`Added diagnosis: ${displayName}`); // Debug log
			} catch (error) {
				console.warn('Error processing file:', file.path, error);
			}
		}

		console.log('Total diagnoses found:', diagnoses.length); // Debug log
		return diagnoses.sort((a, b) => a.name.localeCompare(b.name));
	}

	async getManufacturersFromPrescriptions(): Promise<string[]> {
		const manufacturers = new Set<string>();

		console.log('Scanning prescription notes for manufacturers...'); // Debug log

		// Get all markdown files in the prescription folder and its subfolders
		const allFiles = this.app.vault.getMarkdownFiles();
		const prescriptionFiles = allFiles.filter(file =>
			file.path.startsWith(this.settings.prescriptionFolder + '/')
		);

		console.log('Found prescription files:', prescriptionFiles.length); // Debug log

		for (const file of prescriptionFiles) {
			try {
				const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

				if (frontmatter && frontmatter.fileClass === 'Prescriptions' && frontmatter.mfg) {
					const manufacturer = frontmatter.mfg.toString().trim();
					if (manufacturer && manufacturer !== '' && manufacturer !== 'undefined') {
						manufacturers.add(manufacturer);
						console.log(`Found manufacturer: ${manufacturer} in ${file.path}`); // Debug log
					}
				}
			} catch (error) {
				console.warn('Error reading prescription file:', file.path, error);
			}
		}

		const uniqueManufacturers = Array.from(manufacturers).sort();
		console.log('Total unique manufacturers found:', uniqueManufacturers.length, uniqueManufacturers); // Debug log
		return uniqueManufacturers;
	}

	async createPrescriptionNote(data: PrescriptionData) {
		const baseFolder = this.settings.prescriptionFolder;

		// Get the date-organized folder path using fill date
		const dateFolderPath = getDateBasedPath(data.fillDate, baseFolder, this.settings.dateOrganization);

		// Ensure the folder exists
		await this.ensureFolderExists(dateFolderPath);

		// Calculate dateFinished based on dateObtained + daysSupply
		let dateFinished = '';
		if (data.obtainedDate && data.daysSupply > 0) {
			const obtainedDate = moment(data.obtainedDate);
			const finishedDate = obtainedDate.add(data.daysSupply, 'days');
			dateFinished = finishedDate.format('YYYY-MM-DD');
		}

		// Handle drug label file renaming if one was selected
		let drugLabelFileName = '';
		if (data.drugLabel && data.drugLabel.trim()) {
			console.log('Drug label selected, attempting to rename:', data.drugLabel);
			drugLabelFileName = await this.renameDrugLabelFile(data);
			console.log('Rename result:', drugLabelFileName);
		} else {
			console.log('No drug label selected for renaming');
		}

		// Create filename in format: YYYYMMDD - Rx<number> -- <medication> <dose>.md
		const dateFormatted = data.fillDate.replace(/[-]/g, ''); // Convert YYYY-MM-DD to YYYYMMDD
		const safeMedication = data.medicationName.replace(/[<>:"/\\|?*\[\]]/g, ''); // Remove illegal file system chars but keep spaces
		const safeDosage = data.dosage.replace(/[<>:"/\\|?*\[\]]/g, ''); // Remove illegal file system chars but keep hyphens
		const prescriptionNum = data.prescriptionNumber || 'UNKNOWN';

		const fileName = `${dateFormatted} - Rx${prescriptionNum} -- ${safeMedication} ${safeDosage}`;
		const filePath = `${dateFolderPath}/${fileName}.md`;

		// Create the note content with YAML frontmatter
		const frontmatter = `---
fileClass: Prescriptions
filename: ${fileName}
rxNum: "${data.prescriptionNumber}"
medication: "${data.medicationName}"
diagnosis: "${data.diagnosis}"
pharmacy: ${data.pharmacy}
prescriber: "${data.prescribedBy}"
qtyWrit: ${data.quantityWritten}
qtyDisp: ${data.quantityDispensed}
refills: ${data.refillsRemaining}
dose: ${data.dosage}
dateWritten: ${data.dateWritten}
dateFilled: ${data.fillDate}
dateObtained: ${data.obtainedDate}
copay: ${data.copay}
mfg: ${data.manufacturer}
patient: "${data.patient}"
drugLabel: ${drugLabelFileName ? `"[[${drugLabelFileName}]]"` : '""'}
substituted: ${data.substituted}
daySupply: ${data.daysSupply}
dateFinished: ${dateFinished}
---

# ${data.medicationName.replace(/[\[\]]/g, '')} ${data.dosage}
`;

		try {
			const file = await this.app.vault.create(filePath, frontmatter);
			new Notice(`Prescription note created: ${fileName}`);

			// Open the newly created note
			const leaf = this.app.workspace.getUnpinnedLeaf();
			if (leaf) {
				await leaf.openFile(file);
			}
		} catch (error) {
			new Notice(`Error creating prescription note: ${error.message}`);
		}
	}

	async ensureFolderExists(folderPath: string) {
		const normalizedPath = normalizePath(folderPath);
		const parts = normalizedPath.split('/');
		let currentPath = '';

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const folder = this.app.vault.getAbstractFileByPath(currentPath);
			if (!folder) {
				try {
					await this.app.vault.createFolder(currentPath);
				} catch (error) {
					// Folder might already exist, ignore the error
					console.log(`Could not create folder ${currentPath}:`, error);
				}
			}
		}
	}

	async renameDrugLabelFile(data: PrescriptionData): Promise<string> {
		try {
			console.log('=== Drug Label Renaming Debug ===');
			console.log('Input data.drugLabel:', data.drugLabel);
			console.log('Fill date:', data.fillDate);
			console.log('Pharmacy:', data.pharmacy);
			console.log('Medication:', data.medicationName);
			console.log('Dosage:', data.dosage);

			// Get the original file
			const originalFile = this.app.vault.getAbstractFileByPath(data.drugLabel);
			console.log('Original file found:', originalFile ? 'YES' : 'NO');
			console.log('Original file details:', originalFile);

			if (!originalFile || !(originalFile instanceof TFile)) {
				console.warn('Drug label file not found:', data.drugLabel);
				new Notice(`Drug label file not found: ${data.drugLabel}`);
				return '';
			}

			// Validate required fields
			if (!data.fillDate || !data.pharmacy || !data.medicationName || !data.dosage) {
				console.warn('Missing required fields for drug label renaming');
				new Notice('Missing required fields (date, pharmacy, medication, or dosage) for drug label renaming');
				return '';
			}

			// Create new filename following the pattern: YYYYMMDD - <Pharmacy> -- <medication> <dose>
			const dateFormatted = data.fillDate.replace(/[-]/g, ''); // Convert YYYY-MM-DD to YYYYMMDD

			// Clean up fields that might contain link formatting
			const cleanPharmacy = data.pharmacy.replace(/[\[\]]/g, '').trim(); // Remove link brackets
			const cleanMedication = data.medicationName.replace(/[\[\]]/g, '').trim(); // Remove link brackets
			const cleanDosage = data.dosage.replace(/[\[\]]/g, '').trim(); // Remove link brackets

			const safePharmacy = cleanPharmacy.replace(/[<>:"/\\|?*]/g, ''); // Remove illegal file system chars
			const safeMedication = cleanMedication.replace(/[<>:"/\\|?*]/g, ''); // Remove illegal file system chars
			const safeDosage = cleanDosage.replace(/[<>:"/\\|?*]/g, ''); // Remove illegal file system chars

			console.log('Clean pharmacy:', cleanPharmacy, '-> Safe:', safePharmacy);
			console.log('Clean medication:', cleanMedication, '-> Safe:', safeMedication);
			console.log('Clean dosage:', cleanDosage, '-> Safe:', safeDosage);

			// Get the file extension from the original file
			const fileExtension = originalFile.extension;
			const newFileName = `${dateFormatted} - ${safePharmacy} -- ${safeMedication} ${safeDosage}.${fileExtension}`;

			// Get the directory of the original file
			const originalDir = originalFile.parent?.path || '';
			const newFilePath = originalDir ? `${originalDir}/${newFileName}` : newFileName;

			console.log(`Attempting to rename drug label from "${originalFile.path}" to "${newFilePath}"`);

			// Check if target file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(newFilePath);
			if (existingFile) {
				console.warn('Target filename already exists:', newFilePath);
				new Notice(`Target filename already exists: ${newFileName}`);
				return '';
			}

			// Rename the file
			await this.app.vault.rename(originalFile, newFilePath);
			console.log('File successfully renamed!');
			new Notice(`Drug label renamed to: ${newFileName}`);

			// Return the new filename WITH extension for the link (PDF files should include extension)
			const linkName = newFileName; // Keep the full filename including .pdf extension
			console.log('Returning link name:', linkName);
			console.log('=== End Drug Label Renaming Debug ===');
			return linkName;

		} catch (error) {
			console.error('Error renaming drug label file:', error);
			new Notice(`Error renaming drug label file: ${error.message}`);
			return '';
		}
	}

	async promptForMedicationName() {
		const modal = new MedicationSelectionModal(this.app, this, async (medicationData) => {
			try {
				const filePath = await generateMedicationNote(medicationData, this.settings.medicationsFolder, this.app, false);
				new Notice(`Medication note created: ${medicationData.title}`);

				// Open the newly created note
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file) {
					const leaf = this.app.workspace.getUnpinnedLeaf();
					if (leaf) {
						await leaf.openFile(file as TFile);
					}
				}
			} catch (error) {
				// Handle file already exists error more gracefully
				if (error.message.includes('already exists')) {
					new Notice(`A medication note for "${medicationData.title}" already exists. Use "Convert current file" if you want to update it.`);
				} else {
					new Notice(`Error creating medication note: ${error.message}`);
				}
				console.error('Error creating medication note:', error);
			}
		});
		modal.open();
	}

	async convertCurrentMedicationNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file to convert');
			return;
		}

		// Check if file is in medications folder (with normalized paths)
		const normalizedMedicationsFolder = normalizePath(this.settings.medicationsFolder);
		const normalizedFilePath = normalizePath(activeFile.path);
		
		if (!normalizedFilePath.startsWith(normalizedMedicationsFolder + '/')) {
			new Notice(`Current file is not in the medications folder. Expected folder: "${this.settings.medicationsFolder}"`);
			console.log(`📍 File check: "${normalizedFilePath}" not in "${normalizedMedicationsFolder}"`);
			return;
		}

		// Additional check: ensure it's a markdown file
		if (activeFile.extension !== 'md') {
			new Notice('Current file is not a markdown file');
			return;
		}

		console.log(`✅ File validation passed: ${activeFile.path} is in medications folder`);

		try {
			// Extract medication name from filename or content
			const medicationName = this.extractMedicationName(activeFile);
			if (!medicationName) {
				new Notice('Could not extract medication name from current file');
				return;
			}

			console.log(`🔄 Converting medication file: ${activeFile.name} -> ${medicationName}`);

			// Search for the medication data
			const searchResults = await searchMedications(medicationName);
			if (searchResults.length === 0) {
				new Notice(`No medication data found for: ${medicationName}`);
				return;
			}

			// Use the first result (highest score)
			const medicationData = searchResults[0];

			// Generate new content with the enhanced structure (allow overwrite for conversion)
			const filePath = await generateMedicationNote(medicationData, this.settings.medicationsFolder, this.app, true);
			
			// Delete the old file if it's different from the new one
			const newFile = this.app.vault.getAbstractFileByPath(filePath);
			if (newFile && newFile.path !== activeFile.path) {
				await this.app.vault.delete(activeFile);
				console.log(`🗑️ Deleted old file: ${activeFile.path}`);
			}

			new Notice(`Medication note converted: ${medicationData.title}`);

			// Open the converted note
			if (newFile) {
				const leaf = this.app.workspace.getUnpinnedLeaf();
				if (leaf) {
					await leaf.openFile(newFile as TFile);
				}
			}

		} catch (error) {
			// Handle conversion errors more gracefully
			if (error.message.includes('already exists')) {
				new Notice(`Error: Could not convert medication note - ${error.message}`);
			} else {
				new Notice(`Error converting medication note: ${error.message}`);
			}
			console.error('Error converting medication note:', error);
		}
	}

	private extractMedicationName(file: TFile): string | null {
		// Try to extract from filename first (remove .md extension)
		let medicationName = file.basename;

		// Clean up common filename patterns
		// Remove date patterns like "2024-01-01 - " or timestamps
		medicationName = medicationName.replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, '');
		medicationName = medicationName.replace(/^\d{8}\s*-\s*/, '');
		
		// Remove prescription numbers like "Rx12345 - "
		medicationName = medicationName.replace(/^Rx\d+\s*-\s*/, '');
		
		// Remove dosage information from the end (like " 10mg", " 5mg twice daily")
		medicationName = medicationName.replace(/\s+\d+(\.\d+)?\s*(mg|mcg|g|ml|units?)(\s+.*)?$/i, '');
		
		// Remove common trailing patterns
		medicationName = medicationName.replace(/\s*-\s*medication$/i, '');
		medicationName = medicationName.replace(/\s*note$/i, '');
		
		// Clean up any remaining dashes or extra spaces
		medicationName = medicationName.replace(/^\s*-\s*/, '').replace(/\s*-\s*$/, '').trim();

		console.log(`📝 Extracted medication name: "${file.basename}" -> "${medicationName}"`);

		return medicationName.length > 0 ? medicationName : null;
	}

	private async promptForText(title: string, placeholder: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new TextInputModal(this.app, title, placeholder, (result) => {
				resolve(result);
			});
			modal.open();
		});
	}
}

class MedicationSelectionModal extends Modal {
	plugin: PrescriptionTrackerPlugin;
	onSelectCallback: (medicationData: any) => void;
	searchResults: any[] = [];

	constructor(app: App, plugin: PrescriptionTrackerPlugin, onSelect: (medicationData: any) => void) {
		super(app);
		this.plugin = plugin;
		this.onSelectCallback = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: 'Create Medication Note' });

		// Search input
		const searchContainer = contentEl.createDiv({ cls: 'search-container' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search for a medication...',
			cls: 'search-input'
		});

		// Results container
		const resultsContainer = contentEl.createDiv({ cls: 'search-results' });

		// Handle search input
		searchInput.addEventListener('input', async (e) => {
			const query = (e.target as HTMLInputElement).value.trim();
			if (query.length >= 2) {
				// Show loading message
				resultsContainer.empty();
				resultsContainer.createEl('p', { text: 'Searching RxNorm database...' });

				try {
					this.searchResults = await searchMedications(query);
					this.displayResults(resultsContainer);
				} catch (error) {
					console.error('Search failed:', error);
					resultsContainer.empty();
					resultsContainer.createEl('p', { text: 'Search failed. Please try again.' });
				}
			} else {
				resultsContainer.empty();
				resultsContainer.createEl('p', { text: 'Type at least 2 characters to search...' });
			}
		});

		// Initial message
		resultsContainer.createEl('p', { text: 'Type at least 2 characters to search the RxNorm medication database...' });

		// Focus the search input
		searchInput.focus();
	}

	displayResults(container: HTMLElement) {
		container.empty();

		if (this.searchResults.length === 0) {
			container.createEl('p', { text: 'No medications found. Try a different search term.' });
			return;
		}

		this.searchResults.forEach(med => {
			const resultEl = container.createDiv({ cls: 'search-result-item' });

			const titleEl = resultEl.createEl('div', { cls: 'result-title', text: med.title });

			const detailsEl = resultEl.createEl('div', { cls: 'result-details' });

			// Show generic name if available
			if (med.generic_name && med.generic_name !== med.title) {
				detailsEl.createEl('span', {
					text: `Generic: ${med.generic_name}`,
					cls: 'result-generic'
				});
			}

			// Show brand names if available and different from title
			if (med.brand_names && med.brand_names.length > 1) {
				const brandText = med.brand_names.filter((brand: string) => brand !== med.title).slice(0, 3).join(', ');
				if (brandText) {
					detailsEl.createEl('span', {
						text: ` • Brands: ${brandText}`,
						cls: 'result-brands'
					});
				}
			}

			resultEl.addEventListener('click', () => {
				this.onSelectCallback(med);
				this.close();
			});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class PrescriptionModal extends Modal {
	plugin: PrescriptionTrackerPlugin;
	data: PrescriptionData;

	constructor(app: App, plugin: PrescriptionTrackerPlugin) {
		super(app);
		this.plugin = plugin;
		this.data = {
			medicationName: '',
			fillDate: new Date().toISOString().split('T')[0], // Today's date
			obtainedDate: new Date().toISOString().split('T')[0], // Today's date
			pharmacy: '',
			prescriptionNumber: '',
			dosage: '',
			daysSupply: 0,
			quantityDispensed: '',
			copay: '',
			manufacturer: '',
			patient: '',
			frequency: '',
			prescribedBy: '',
			instructions: '',
			refillsRemaining: 0,
			notes: '',
			diagnosis: '',
			quantityWritten: '',
			dateWritten: '',
			drugLabel: '',
			substituted: '',
			dateFinished: ''
		};
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.addClass('prescription-modal');
		contentEl.createEl('h2', { text: 'Add New Prescription' });

		// Medication Name - Get medications and create dropdown
		const medicationSetting = new Setting(contentEl)
			.setName('Medication Name')
			.setDesc('Name of the prescribed medication');

		// Always create a dropdown, even if no medications are found
		medicationSetting.addDropdown(dropdown => {
			dropdown.addOption('', 'Select a medication...');
			dropdown.addOption('__custom__', 'Other (enter manually)');

			// Try to get medications from medications folder
			this.plugin.getMedicationsFromFolder().then(medications => {
				console.log('Found medications:', medications); // Debug log

				if (medications.length > 0) {
					// Clear existing options and rebuild
					dropdown.selectEl.empty();
					dropdown.addOption('', 'Select a medication...');

					medications.forEach(medication => {
						dropdown.addOption(medication.link, medication.name);
					});
					dropdown.addOption('__custom__', 'Other (enter manually)');

					// Set current value if it exists
					if (this.data.medicationName) {
						dropdown.setValue(this.data.medicationName);
					}
				} else {
					console.log('No medications found in medications folder'); // Debug log
				}
			}).catch(error => {
				console.warn('Error loading medications:', error);
			});

			dropdown.setValue(this.data.medicationName);
			dropdown.onChange(async (value) => {
				if (value === '__custom__') {
					this.data.medicationName = '__custom__';
					this.showCustomMedicationInput(medicationSetting.settingEl);
				} else {
					this.data.medicationName = value;
				}
			});
		});

		// Prescription Fill Date
		new Setting(contentEl)
			.setName('Prescription Fill Date')
			.setDesc('Date the prescription was filled at the pharmacy')
			.addText(text => {
				text.inputEl.type = 'date';
				text.setValue(this.data.fillDate)
					.onChange(async (value) => {
						this.data.fillDate = value;
					});
			});

		// Prescription Obtained Date
		new Setting(contentEl)
			.setName('Prescription Obtained Date')
			.setDesc('Date the prescription was originally issued/obtained')
			.addText(text => {
				text.inputEl.type = 'date';
				text.setValue(this.data.obtainedDate)
					.onChange(async (value) => {
						this.data.obtainedDate = value;
					});
			});

		// Pharmacy
		new Setting(contentEl)
			.setName('Pharmacy')
			.setDesc('Pharmacy where prescription was filled')
			.addDropdown(dropdown => {
				// Add empty option
				dropdown.addOption('', 'Select a pharmacy...');

				// Add pharmacies from settings
				this.plugin.settings.pharmacyList.forEach(pharmacy => {
					dropdown.addOption(pharmacy, pharmacy);
				});

				// Add option for custom entry
				dropdown.addOption('__custom__', 'Other (enter manually)');

				dropdown.setValue(this.data.pharmacy);
				dropdown.onChange(async (value) => {
					if (value === '__custom__') {
						// Replace dropdown with text input
						const settingItem = dropdown.selectEl.closest('.setting-item');
						if (settingItem) {
							this.showCustomPharmacyInput(settingItem as HTMLElement);
						}
					} else {
						this.data.pharmacy = value;
					}
				});
			});

		// Prescription Number
		new Setting(contentEl)
			.setName('Prescription Number')
			.setDesc('Prescription number from the pharmacy')
			.addText(text => text
				.setPlaceholder('e.g., 6298009')
				.setValue(this.data.prescriptionNumber)
				.onChange(async (value) => {
					this.data.prescriptionNumber = value;
				}));

		// Dose
		new Setting(contentEl)
			.setName('Dose')
			.setDesc('Dosage and strength')
			.addText(text => text
				.setPlaceholder('e.g., 10mg')
				.setValue(this.data.dosage)
				.onChange(async (value) => {
					this.data.dosage = value;
				}));

		// How Many Days Supply
		new Setting(contentEl)
			.setName('Days Supply')
			.setDesc('Number of days the prescription should last')
			.addText(text => text
				.setPlaceholder('e.g., 30')
				.setValue(this.data.daysSupply.toString())
				.onChange(async (value) => {
					this.data.daysSupply = parseInt(value) || 0;
				}));

		// Quantity Dispensed
		new Setting(contentEl)
			.setName('Quantity Dispensed')
			.setDesc('Amount of medication dispensed')
			.addText(text => text
				.setPlaceholder('e.g., 30 tablets')
				.setValue(this.data.quantityDispensed)
				.onChange(async (value) => {
					this.data.quantityDispensed = value;
				}));

		// Copay
		new Setting(contentEl)
			.setName('Copay')
			.setDesc('Amount paid for the prescription')
			.addText(text => text
				.setPlaceholder('e.g., $15.00')
				.setValue(this.data.copay)
				.onChange(async (value) => {
					this.data.copay = value;
				}));

		// Manufacturer - Get manufacturers from existing prescriptions and create dropdown
		const manufacturerSetting = new Setting(contentEl)
			.setName('Manufacturer')
			.setDesc('Pharmaceutical manufacturer');

		// Always create a dropdown, even if no manufacturers are found
		manufacturerSetting.addDropdown(dropdown => {
			dropdown.addOption('', 'Select a manufacturer...');
			dropdown.addOption('__custom__', 'Other (enter manually)');

			// Try to get manufacturers from existing prescription notes
			this.plugin.getManufacturersFromPrescriptions().then(manufacturers => {
				console.log('Found manufacturers:', manufacturers); // Debug log

				if (manufacturers.length > 0) {
					// Clear existing options and rebuild
					dropdown.selectEl.empty();
					dropdown.addOption('', 'Select a manufacturer...');

					manufacturers.forEach(manufacturer => {
						dropdown.addOption(manufacturer, manufacturer);
					});
					dropdown.addOption('__custom__', 'Other (enter manually)');

					// Set current value if it exists
					if (this.data.manufacturer) {
						dropdown.setValue(this.data.manufacturer);
					}
				} else {
					console.log('No manufacturers found in existing prescription notes'); // Debug log
				}
			}).catch(error => {
				console.warn('Error loading manufacturers:', error);
			});

			dropdown.setValue(this.data.manufacturer);
			dropdown.onChange(async (value) => {
				if (value === '__custom__') {
					this.data.manufacturer = '__custom__';
					this.showCustomManufacturerInput(manufacturerSetting.settingEl);
				} else {
					this.data.manufacturer = value;
				}
			});
		});

		// Patient
		const patientSetting = new Setting(contentEl)
			.setName('Patient')
			.setDesc('Select from People notes or enter manually')
			.addDropdown(dropdown => {
				// Add empty option
				dropdown.addOption('', 'Select a patient...');

				// Try to get patients from people notes
				this.plugin.getPatientsFromPeopleNotes().then(patients => {
					if (patients.length > 0) {
						// Clear existing options and rebuild
						dropdown.selectEl.empty();
						dropdown.addOption('', 'Select a patient...');

						// Add patients from People notes
						patients.forEach(patient => {
							dropdown.addOption(patient.link, patient.name);
						});
					}

					// Add option for custom entry
					dropdown.addOption('__custom__', 'Other (enter manually)');

					// Set current value if it exists
					if (this.data.patient) {
						dropdown.setValue(this.data.patient);
					}
				}).catch(error => {
					console.error('Error loading patients from people notes:', error);

					// Fallback to just custom entry option
					dropdown.addOption('__custom__', 'Other (enter manually)');

					if (this.data.patient) {
						dropdown.setValue(this.data.patient);
					}
				});

				dropdown.onChange(async (value) => {
					if (value === '__custom__') {
						this.data.patient = '__custom__';
						this.showCustomPatientInput(patientSetting.settingEl);
					} else if (value === '__separator__') {
						// Do nothing for separator
						return;
					} else {
						this.data.patient = value;
					}
				});
			});

		// Drug Label (file from +Inbox folder)
		new Setting(contentEl)
			.setName('Drug Label')
			.setDesc('Select a PDF file from the +Inbox folder for the drug label')
			.addDropdown(dropdown => {
				// Add empty option
				dropdown.addOption('', 'Select a file...');

				// Get files from +Inbox folder - only PDF files with underscores
				const inboxFolder = this.app.vault.getAbstractFileByPath('+Inbox');
				if (inboxFolder instanceof TFolder) {
					const files = inboxFolder.children.filter(file => {
						if (file instanceof TFile) {
							// Only include PDF files that contain an underscore in the name
							return file.extension === 'pdf' && file.name.includes('_');
						}
						return false;
					});

					files.forEach(file => {
						if (file instanceof TFile) {
							dropdown.addOption(file.path, file.name);
						}
					});
				}

				dropdown.setValue(this.data.drugLabel);
				dropdown.onChange(async (value) => {
					this.data.drugLabel = value;
				});
			});

		// Substituted
		new Setting(contentEl)
			.setName('Substituted')
			.setDesc('Whether the medication was substituted')
			.addText(text => text
				.setPlaceholder('e.g., Generic substitution')
				.setValue(this.data.substituted)
				.onChange(async (value) => {
					this.data.substituted = value;
				}));

		// Frequency
		new Setting(contentEl)
			.setName('Frequency')
			.setDesc('How often to take the medication')
			.addText(text => text
				.setPlaceholder('e.g., Once daily')
				.setValue(this.data.frequency)
				.onChange(async (value) => {
					this.data.frequency = value;
				}));

		// Prescribed By - Get doctors and create dropdown
		const prescriberSetting = new Setting(contentEl)
			.setName('Prescribed By')
			.setDesc('Doctor or healthcare provider');

		// Always create a dropdown, even if no doctors are found
		prescriberSetting.addDropdown(dropdown => {
			dropdown.addOption('', 'Select a doctor...');
			dropdown.addOption('__custom__', 'Other (enter manually)');

			// Try to get doctors from people notes
			this.plugin.getDoctorsFromPeopleNotes().then(doctors => {
				console.log('Found doctors:', doctors); // Debug log

				if (doctors.length > 0) {
					// Clear existing options and rebuild
					dropdown.selectEl.empty();
					dropdown.addOption('', 'Select a doctor...');

					doctors.forEach(doctor => {
						dropdown.addOption(doctor.link, doctor.name);
					});
					dropdown.addOption('__custom__', 'Other (enter manually)');

					// Set current value if it exists
					if (this.data.prescribedBy) {
						dropdown.setValue(this.data.prescribedBy);
					}
				} else {
					console.log('No doctors found in people notes'); // Debug log
				}
			}).catch(error => {
				console.warn('Error loading doctors:', error);
			});

			dropdown.setValue(this.data.prescribedBy);
			dropdown.onChange(async (value) => {
				if (value === '__custom__') {
					this.data.prescribedBy = '__custom__';
					this.showCustomPrescriberInput(prescriberSetting.settingEl);
				} else {
					this.data.prescribedBy = value;
				}
			});
		});

		// Refills Remaining
		new Setting(contentEl)
			.setName('Refills Remaining')
			.setDesc('Number of refills remaining')
			.addText(text => text
				.setPlaceholder('e.g., 5')
				.setValue(this.data.refillsRemaining.toString())
				.onChange(async (value) => {
					this.data.refillsRemaining = parseInt(value) || 0;
				}));

		// Diagnosis
		const diagnosisSetting = new Setting(contentEl)
			.setName('Diagnosis')
			.setDesc('Select from diagnosis notes or enter manually')
			.addDropdown(dropdown => {
				// Add empty option
				dropdown.addOption('', 'Select a diagnosis...');

				// Try to get diagnoses from folder
				this.plugin.getDiagnosesFromFolder().then(diagnoses => {
					console.log('Found diagnoses:', diagnoses); // Debug log

					if (diagnoses.length > 0) {
						// Clear existing options and rebuild
						dropdown.selectEl.empty();
						dropdown.addOption('', 'Select a diagnosis...');

						diagnoses.forEach(diagnosis => {
							dropdown.addOption(diagnosis.link, diagnosis.name);
						});
						dropdown.addOption('__custom__', 'Other (enter manually)');

						// Set current value if it exists
						if (this.data.diagnosis) {
							dropdown.setValue(this.data.diagnosis);
						}
					} else {
						console.log('No diagnoses found in folder'); // Debug log
						dropdown.addOption('__custom__', 'Other (enter manually)');

						if (this.data.diagnosis) {
							dropdown.setValue(this.data.diagnosis);
						}
					}
				}).catch(error => {
					console.error('Error loading diagnoses:', error);
					dropdown.addOption('__custom__', 'Other (enter manually)');

					if (this.data.diagnosis) {
						dropdown.setValue(this.data.diagnosis);
					}
				});

				dropdown.onChange(async (value) => {
					if (value === '__custom__') {
						this.data.diagnosis = '__custom__';
						this.showCustomDiagnosisInput(diagnosisSetting.settingEl);
					} else {
						this.data.diagnosis = value;
					}
				});
			});

		// Quantity Written
		new Setting(contentEl)
			.setName('Quantity Written')
			.setDesc('Original quantity prescribed by the doctor')
			.addText(text => text
				.setPlaceholder('e.g., 30 tablets')
				.setValue(this.data.quantityWritten)
				.onChange(async (value) => {
					this.data.quantityWritten = value;
				}));

		// Date Written
		new Setting(contentEl)
			.setName('Date Written')
			.setDesc('Date the prescription was originally written/prescribed')
			.addText(text => {
				text.inputEl.type = 'date';
				text.setValue(this.data.dateWritten)
					.onChange(async (value) => {
						this.data.dateWritten = value;
					});
			});

		// Instructions
		new Setting(contentEl)
			.setName('Instructions')
			.setDesc('Special instructions for taking the medication')
			.addTextArea(text => text
				.setPlaceholder('e.g., Take with food')
				.setValue(this.data.instructions)
				.onChange(async (value) => {
					this.data.instructions = value;
				}));

		// Notes
		new Setting(contentEl)
			.setName('Additional Notes')
			.setDesc('Any additional notes or observations')
			.addTextArea(text => text
				.setPlaceholder('Additional notes...')
				.setValue(this.data.notes)
				.onChange(async (value) => {
					this.data.notes = value;
				}));

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.onclick = () => this.close();

		const okButton = buttonContainer.createEl('button', { text: 'Create Note', cls: 'mod-cta' });
		okButton.onclick = async () => {
			if (!this.data.medicationName.trim()) {
				new Notice('Please enter a medication name');
				return;
			}
			if (!this.data.prescriptionNumber.trim()) {
				new Notice('Please enter a prescription number');
				return;
			}
			await this.plugin.createPrescriptionNote(this.data);
			this.close();
		};
	}

	showCustomPharmacyInput(settingItem: HTMLElement) {
		// Clear the current control area
		const controlEl = settingItem.querySelector('.setting-item-control');
		if (controlEl) {
			controlEl.empty();

			// Create text input
			const textInput = controlEl.createEl('input', {
				type: 'text',
				placeholder: 'Enter pharmacy name',
				value: this.data.pharmacy === '__custom__' ? '' : this.data.pharmacy
			});

			textInput.addEventListener('input', () => {
				this.data.pharmacy = textInput.value;
			});

			textInput.focus();
		}
	}

	showCustomMedicationInput(settingItem: HTMLElement) {
		// Clear the current control area
		const controlEl = settingItem.querySelector('.setting-item-control');
		if (controlEl) {
			controlEl.empty();

			// Create text input
			const textInput = controlEl.createEl('input', {
				type: 'text',
				placeholder: 'Enter medication name',
				value: this.data.medicationName === '__custom__' ? '' : this.data.medicationName
			});

			textInput.addEventListener('input', () => {
				this.data.medicationName = textInput.value;
			});

			textInput.focus();
		}
	}

	showCustomDiagnosisInput(settingItem: HTMLElement) {
		// Clear the current control area
		const controlEl = settingItem.querySelector('.setting-item-control');
		if (controlEl) {
			controlEl.empty();

			// Create text input
			const textInput = controlEl.createEl('input', {
				type: 'text',
				placeholder: 'Enter diagnosis',
				value: this.data.diagnosis === '__custom__' ? '' : this.data.diagnosis
			});

			textInput.addEventListener('input', () => {
				this.data.diagnosis = textInput.value;
			});

			textInput.focus();
		}
	}

	showCustomManufacturerInput(settingItem: HTMLElement) {
		// Clear the current control area
		const controlEl = settingItem.querySelector('.setting-item-control');
		if (controlEl) {
			controlEl.empty();

			// Create text input
			const textInput = controlEl.createEl('input', {
				type: 'text',
				placeholder: 'Enter manufacturer name',
				value: this.data.manufacturer === '__custom__' ? '' : this.data.manufacturer
			});

			textInput.addEventListener('input', () => {
				this.data.manufacturer = textInput.value;
			});

			textInput.focus();
		}
	}

	showCustomPatientInput(settingItem: HTMLElement) {
		// Clear the current control area
		const controlEl = settingItem.querySelector('.setting-item-control');
		if (controlEl) {
			controlEl.empty();

			// Create text input
			const textInput = controlEl.createEl('input', {
				type: 'text',
				placeholder: 'Enter patient name',
				value: this.data.patient === '__custom__' ? '' : this.data.patient
			});

			textInput.addEventListener('input', () => {
				this.data.patient = textInput.value;
			});

			textInput.focus();
		}
	}

	showCustomPrescriberInput(settingItem: HTMLElement) {
		// Clear the current control area
		const controlEl = settingItem.querySelector('.setting-item-control');
		if (controlEl) {
			controlEl.empty();

			// Create text input
			const textInput = controlEl.createEl('input', {
				type: 'text',
				placeholder: 'Enter prescriber name',
				value: this.data.prescribedBy === '__custom__' ? '' : this.data.prescribedBy
			});

			textInput.addEventListener('input', () => {
				this.data.prescribedBy = textInput.value;
			});

			textInput.focus();
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class TextInputModal extends Modal {
	private result: string;
	private onSubmit: (result: string) => void;
	private title: string;
	private placeholder: string;

	constructor(app: App, title: string, placeholder: string, onSubmit: (result: string) => void) {
		super(app);
		this.title = title;
		this.placeholder = placeholder;
		this.onSubmit = onSubmit;
		this.result = '';
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: this.title });

		const inputContainer = contentEl.createDiv({ cls: 'text-input-container' });
		const textInput = inputContainer.createEl('input', {
			type: 'text',
			placeholder: this.placeholder
		});
		textInput.style.width = '100%';
		textInput.style.marginBottom = '10px';

		textInput.addEventListener('input', () => {
			this.result = textInput.value;
		});

		textInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				this.close();
				this.onSubmit(this.result);
			}
			if (e.key === 'Escape') {
				this.close();
				this.onSubmit('');
			}
		});

		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '10px';

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.onclick = () => {
			this.close();
			this.onSubmit('');
		};

		const okButton = buttonContainer.createEl('button', { text: 'Create', cls: 'mod-cta' });
		okButton.onclick = () => {
			this.close();
			this.onSubmit(this.result);
		};

		textInput.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
