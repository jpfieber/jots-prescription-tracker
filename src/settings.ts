import { App, PluginSettingTab, Setting, TFolder, AbstractInputSuggest, TFile } from 'obsidian';
import type PrescriptionTrackerPlugin from './main';

class FolderSuggest extends AbstractInputSuggest<TFolder> {
    textInputEl: HTMLInputElement;

    constructor(app: App, textInputEl: HTMLInputElement) {
        super(app, textInputEl);
        this.textInputEl = textInputEl;
    }

    getSuggestions(inputStr: string): TFolder[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const folders: TFolder[] = [];
        const lowerCaseInputStr = inputStr.toLowerCase();

        abstractFiles.forEach((folder: TFile | TFolder) => {
            if (folder instanceof TFolder) {
                if (folder.path.toLowerCase().contains(lowerCaseInputStr)) {
                    folders.push(folder);
                }
            }
        });

        return folders;
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.setText(folder.path);
    }

    selectSuggestion(folder: TFolder): void {
        this.textInputEl.value = folder.path;
        this.textInputEl.trigger("input");
        this.close();
    }
}

export class PrescriptionTrackerSettingTab extends PluginSettingTab {
    plugin: PrescriptionTrackerPlugin;

    constructor(app: App, plugin: PrescriptionTrackerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Prescription Tracker Settings' });

        new Setting(containerEl)
            .setName('Prescription Folder')
            .setDesc('Folder where prescription notes will be stored')
            .addText(text => {
                text
                    .setPlaceholder('Prescriptions')
                    .setValue(this.plugin.settings.prescriptionFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.prescriptionFolder = value;
                        await this.plugin.saveSettings();
                    });

                // Add folder suggestion
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName('Date Organization')
            .setDesc('How to organize notes by date within the prescription folder. Use YYYY for year, MM for month, DD for day.')
            .addText(text => {
                text
                    .setPlaceholder('YYYY/YYYY-MM')
                    .setValue(this.plugin.settings.dateOrganization)
                    .onChange(async (value) => {
                        this.plugin.settings.dateOrganization = value;
                        await this.plugin.saveSettings();
                    });
            });

        containerEl.createEl('p', {
            text: 'Note: Folders will be created automatically if they don\'t exist.',
            cls: 'setting-item-description'
        });

        // Pharmacy Management Section
        containerEl.createEl('h3', { text: 'Pharmacy Management' });

        // Display current pharmacies
        const pharmacyListEl = containerEl.createDiv();
        this.updatePharmacyList(pharmacyListEl);

        // Add new pharmacy
        new Setting(containerEl)
            .setName('Add New Pharmacy')
            .setDesc('Add a new pharmacy to the list')
            .addText(text => {
                text.setPlaceholder('Enter pharmacy name');

                const addButton = text.inputEl.parentElement?.createEl('button', {
                    text: 'Add',
                    cls: 'mod-cta'
                });

                if (addButton) {
                    addButton.style.marginLeft = '10px';
                    addButton.onclick = async () => {
                        const pharmacyName = text.getValue().trim();
                        if (pharmacyName && !this.plugin.settings.pharmacyList.includes(pharmacyName)) {
                            this.plugin.settings.pharmacyList.push(pharmacyName);
                            await this.plugin.saveSettings();
                            text.setValue('');
                            this.updatePharmacyList(pharmacyListEl);
                        }
                    };
                }
            });

        // Patient Management Section
        containerEl.createEl('h3', { text: 'Patient Management' });

        // Select People Notes as Patients
        containerEl.createEl('h4', { text: 'Select People Notes as Patients' });

        // Display current selected patient notes
        const selectedPatientNotesEl = containerEl.createDiv();
        this.updateSelectedPatientNotesList(selectedPatientNotesEl);

        // Add People note as patient
        new Setting(containerEl)
            .setName('Add People Note as Patient')
            .setDesc('Select a person from your People notes to add as a patient option')
            .addDropdown(dropdown => {
                dropdown.addOption('', 'Select a person...');

                // Get all people notes
                const peopleFolder = this.app.vault.getAbstractFileByPath(this.plugin.settings.peopleFolder);
                if (peopleFolder && peopleFolder instanceof TFolder) {
                    const files = this.app.vault.getMarkdownFiles().filter(file =>
                        file.path.startsWith(this.plugin.settings.peopleFolder + '/')
                    );

                    files.forEach(file => {
                        // Don't show already selected notes
                        if (!this.plugin.settings.selectedPatientNotes.includes(file.basename)) {
                            dropdown.addOption(file.basename, file.basename);
                        }
                    });
                }

                dropdown.onChange(async (value) => {
                    if (value && !this.plugin.settings.selectedPatientNotes.includes(value)) {
                        this.plugin.settings.selectedPatientNotes.push(value);
                        await this.plugin.saveSettings();
                        this.updateSelectedPatientNotesList(selectedPatientNotesEl);
                        // Refresh the dropdown
                        this.display();
                    }
                });
            });


        // People Notes Integration Section
        containerEl.createEl('h3', { text: 'People Notes Integration' });

        new Setting(containerEl)
            .setName('People Folder')
            .setDesc('Folder containing your people notes (used to find prescribing doctors)')
            .addSearch(search => {
                new FolderSuggest(this.app, search.inputEl);
                search.setPlaceholder('e.g., People')
                    .setValue(this.plugin.settings.peopleFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.peopleFolder = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Relationship Property')
            .setDesc('YAML property name that specifies the relationship (e.g., "relationship", "role", "type")')
            .addText(text => text
                .setPlaceholder('e.g., relationship')
                .setValue(this.plugin.settings.relationshipProperty)
                .onChange(async (value) => {
                    this.plugin.settings.relationshipProperty = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Doctor Relationship Value')
            .setDesc('Value that identifies someone as a prescribing doctor (works with both string and list properties)')
            .addText(text => text
                .setPlaceholder('e.g., doctor')
                .setValue(this.plugin.settings.doctorRelationshipValue)
                .onChange(async (value) => {
                    this.plugin.settings.doctorRelationshipValue = value;
                    await this.plugin.saveSettings();
                }));

        // Medications Integration Section
        containerEl.createEl('h3', { text: 'Medications Integration' });

        new Setting(containerEl)
            .setName('Medications Folder')
            .setDesc('Folder containing your medication notes (used to populate medication dropdown)')
            .addSearch(search => {
                new FolderSuggest(this.app, search.inputEl);
                search.setPlaceholder('e.g., Medications')
                    .setValue(this.plugin.settings.medicationsFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.medicationsFolder = value;
                        await this.plugin.saveSettings();
                    });
            });

        // Diagnosis Integration Section
        containerEl.createEl('h3', { text: 'Diagnosis Integration' });

        new Setting(containerEl)
            .setName('Diagnosis Folder')
            .setDesc('Folder containing your diagnosis notes (used to populate diagnosis dropdown)')
            .addSearch(search => {
                new FolderSuggest(this.app, search.inputEl);
                search.setPlaceholder('e.g., Diagnosis')
                    .setValue(this.plugin.settings.diagnosisFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.diagnosisFolder = value;
                        await this.plugin.saveSettings();
                    });
            });
    }

    updatePharmacyList(containerEl: HTMLElement) {
        containerEl.empty();

        if (this.plugin.settings.pharmacyList.length === 0) {
            containerEl.createEl('p', { text: 'No pharmacies added yet.' });
            return;
        }

        const listEl = containerEl.createEl('ul');
        this.plugin.settings.pharmacyList.forEach((pharmacy, index) => {
            const listItem = listEl.createEl('li');
            listItem.style.display = 'flex';
            listItem.style.justifyContent = 'space-between';
            listItem.style.alignItems = 'center';
            listItem.style.marginBottom = '5px';

            listItem.createEl('span', { text: pharmacy });

            const removeButton = listItem.createEl('button', {
                text: 'Remove',
                cls: 'mod-warning'
            });
            removeButton.style.marginLeft = '10px';
            removeButton.onclick = async () => {
                this.plugin.settings.pharmacyList.splice(index, 1);
                await this.plugin.saveSettings();
                this.updatePharmacyList(containerEl);
            };
        });
    }

    updateSelectedPatientNotesList(containerEl: HTMLElement) {
        containerEl.empty();

        if (this.plugin.settings.selectedPatientNotes.length === 0) {
            containerEl.createEl('p', { text: 'No People notes selected as patients yet.' });
            return;
        }

        const listEl = containerEl.createEl('ul');
        this.plugin.settings.selectedPatientNotes.forEach((patientNote, index) => {
            const listItem = listEl.createEl('li');
            listItem.style.display = 'flex';
            listItem.style.justifyContent = 'space-between';
            listItem.style.alignItems = 'center';
            listItem.style.marginBottom = '5px';

            listItem.createEl('span', { text: patientNote });

            const removeButton = listItem.createEl('button', {
                text: 'Remove',
                cls: 'mod-warning'
            });
            removeButton.style.marginLeft = '10px';
            removeButton.onclick = async () => {
                this.plugin.settings.selectedPatientNotes.splice(index, 1);
                await this.plugin.saveSettings();
                this.updateSelectedPatientNotesList(containerEl);
            };
        });
    }
}
