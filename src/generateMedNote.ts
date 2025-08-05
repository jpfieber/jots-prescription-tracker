import { App, normalizePath } from 'obsidian';
import moment from 'moment';

/**
 * Create a clean, user-friendly description from OpenFDA data
 */
function createCleanDescription(indication: string): string {
    try {
        // Clean up HTML and entities
        let clean = indication
            .replace(/<[^>]+>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
            .replace(/&amp;/g, '&') // Replace &amp; with &
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();

        // Remove section headers like "1 INDICATIONS AND USAGE"
        clean = clean.replace(/^\d+(\.\d+)?\s+[A-Z\s]+(?=\s+[A-Z][a-z])/g, '');

        // Strategy 1: Look for "indicated for" or "treatment of" patterns
        const treatmentMatch = clean.match(/(?:indicated for|used for|treatment of|for the treatment of):\s*(.+?)(?:\.|$)/i);
        if (treatmentMatch) {
            let conditions = treatmentMatch[1].trim();
            
            // Clean up the conditions list
            conditions = conditions
                .replace(/\s+Acute Treatment of\s+/g, ', acute episodes of ')
                .replace(/\s+Adjunctive Treatment of\s+/g, ', as add-on treatment for ')
                .replace(/\s+associated with\s+/gi, ' in people with ')
                .replace(/Major Depressive Disorder/g, 'major depression')
                .replace(/Bipolar I Disorder/g, 'bipolar disorder')
                .replace(/Autistic Disorder/g, 'autism')
                .replace(/Tourette\'s Disorder/g, 'Tourette\'s syndrome');

            if (conditions.length > 10) {
                return `Used to treat ${conditions.toLowerCase()}.`;
            }
        }

        // Strategy 2: Look for "is indicated" patterns
        const indicatedMatch = clean.match(/(.+?)\s+is indicated\s+(?:for|in)\s+(.+?)(?:\.|$)/i);
        if (indicatedMatch && indicatedMatch[2]) {
            let condition = indicatedMatch[2].trim();
            if (condition.length > 10) {
                return `Used to treat ${condition.toLowerCase()}.`;
            }
        }

        // Strategy 3: Look for medication name followed by description
        const medNameMatch = clean.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:gel|cream|tablet|capsule|solution).*?(?:is|are)\s+(.+?)(?:\.|$)/i);
        if (medNameMatch && medNameMatch[2]) {
            let description = medNameMatch[2].trim();
            if (description.length > 10 && description.toLowerCase().includes('indicated')) {
                description = description.replace(/indicated\s+(?:for|in)\s+/i, '');
                return `Used to treat ${description.toLowerCase()}.`;
            }
        }

        // Strategy 4: Extract first meaningful sentence
        const sentences = clean.split(/[.!?]+/);
        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (trimmed.length > 20 && trimmed.length < 200) {
                // Check if it contains useful medical information
                if (/(?:treat|indicated|used|therapy|condition|acne|dermatitis|psoriasis)/i.test(trimmed)) {
                    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase() + '.';
                }
            }
        }

        // Strategy 5: Fallback for specific conditions like acne medications
        if (/(?:acne|comedone|blackhead|whitehead|pimple)/i.test(clean)) {
            return 'Used to treat acne and related skin conditions.';
        }

        console.log(`⚠️ Could not extract meaningful description from: "${clean.substring(0, 100)}..."`);
        return '';

    } catch (error) {
        console.error('Error creating clean description:', error);
        return '';
    }
}

/**
 * Get additional drug information from OpenFDA API
 */
async function getOpenFDADetails(drugName: string): Promise<any> {
    try {
        console.log(`🔍 Searching OpenFDA for: "${drugName}"`);

        // Search OpenFDA drug labeling database for comprehensive information
        const labelResponse = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}"+OR+openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`);
        const labelData = await labelResponse.json();

        if (labelData.results && labelData.results.length > 0) {
            const result = labelData.results[0];
            console.log(`✅ Found OpenFDA labeling data for: ${drugName}`);

            // Extract generic name from OpenFDA data
            let genericName = '';
            if (result.openfda?.generic_name && result.openfda.generic_name.length > 0) {
                genericName = result.openfda.generic_name[0]
                    .toLowerCase() // Convert to lowercase first
                    .replace(/\b\w/g, (l: string) => l.toUpperCase()); // Capitalize first letter of each word (Title Case)
                console.log(`✅ Found generic name from OpenFDA: "${genericName}"`);
            }

            // Create a clean description from OpenFDA data
            let description = '';
            if (result.indications_and_usage && result.indications_and_usage.length > 0) {
                description = createCleanDescription(result.indications_and_usage[0]);
                if (description) {
                    console.log(`✅ Created clean description from OpenFDA`);
                }
            }

            return {
                drug_class: result.openfda?.pharm_class_epc || result.openfda?.pharm_class_moa || [],
                generic_names: genericName ? [genericName] : [],
                brand_names: result.openfda?.brand_name || [],
                what_is_description: description || null
            };
        } else {
            console.log(`ℹ️ No OpenFDA data found for: ${drugName}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ OpenFDA API error for ${drugName}:`, error);
        return null;
    }
}

/**
 * Search for medications using RxNorm API (free NIH/NLM service)
 */
export async function searchMedications(query: string): Promise<any[]> {
    const searchTerm = query.trim();

    if (searchTerm.length < 2) {
        return [];
    }

    console.log(`🔍 Searching for medication: "${searchTerm}"`);

    try {
        // Use RxNorm API with comprehensive search strategies
        const results = await searchRxNorm(searchTerm);

        console.log(`✅ Found ${results.length} results from RxNorm API`);

        if (results.length > 0) {
            return results;
        }

        // If no results found, create a basic entry for the search term
        console.log(`ℹ️ No RxNorm results found, creating basic entry for "${searchTerm}"`);
        return [{
            title: searchTerm,
            name: searchTerm,
            generic_names: [],
            brand_names: [searchTerm],
            drug_class: [],
            approved_use: [],
            mechanism_of_action: "Consult medical references and prescribing information",
            dosage_forms: [],
            standard_dosage: "Consult prescribing information for dosing guidelines",
            side_effects: {
                common: [],
                serious: []
            },
            contraindications: [],
            warnings: [],
            interactions: [],
            approval_date: "",
            manufacturer: "",
            source: `https://www.drugs.com/${searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '-')}.html`,
            isFromAPI: false,
            searchScore: 50
        }];

    } catch (error) {
        console.error('❌ Error searching RxNorm API:', error);

        // Final fallback: create basic entry
        return [{
            title: searchTerm,
            name: searchTerm,
            generic_names: [],
            brand_names: [searchTerm],
            drug_class: [],
            approved_use: [],
            mechanism_of_action: "API search failed - consult medical references",
            dosage_forms: [],
            standard_dosage: "Consult prescribing information for dosing",
            side_effects: {
                common: [],
                serious: []
            },
            contraindications: [],
            warnings: [],
            interactions: [],
            approval_date: "",
            manufacturer: "",
            source: `https://www.drugs.com/${searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '-')}.html`,
            isFromAPI: false,
            searchScore: 25
        }];
    }
}

/**
 * Search RxNorm API for medication suggestions using multiple strategies
 */
async function searchRxNorm(query: string): Promise<any[]> {
    try {
        console.log(`🌐 Starting RxNorm API search for: "${query}"`);

        const results: any[] = [];
        const seenNames = new Set<string>();

        // Strategy 1: Direct RXCUI lookup (exact match)
        try {
            console.log(`📍 Trying direct RXCUI lookup...`);
            const rxcuiResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(query)}&search=1`);
            const rxcuiData = await rxcuiResponse.json();

            if (rxcuiData.idGroup?.rxnormId) {
                const rxcuis = Array.isArray(rxcuiData.idGroup.rxnormId)
                    ? rxcuiData.idGroup.rxnormId
                    : [rxcuiData.idGroup.rxnormId];

                console.log(`✅ Found ${rxcuis.length} direct RXCUI matches`);

                for (const rxcui of rxcuis.slice(0, 5)) {
                    const details = await getRxNormDetails(rxcui);
                    if (details && !seenNames.has(details.name.toLowerCase())) {
                        seenNames.add(details.name.toLowerCase());
                        results.push(createMedicationResult(details, rxcui, 100, true));
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️ Direct RXCUI lookup failed:`, error);
        }

        // Strategy 2: Approximate term search (fuzzy matching)
        try {
            console.log(`🔍 Trying approximate term search...`);
            const approxResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(query)}&maxEntries=20`);
            const approxData = await approxResponse.json();

            if (approxData.approximateGroup?.candidate) {
                const candidates = Array.isArray(approxData.approximateGroup.candidate)
                    ? approxData.approximateGroup.candidate
                    : [approxData.approximateGroup.candidate];

                console.log(`✅ Found ${candidates.length} approximate matches`);

                for (const candidate of candidates.slice(0, 10)) {
                    const candidateName = candidate.candidate.toLowerCase();
                    if (!seenNames.has(candidateName)) {
                        seenNames.add(candidateName);

                        const details = await getRxNormDetails(candidate.rxcui);
                        if (details) {
                            results.push(createMedicationResult(details, candidate.rxcui, candidate.score || 90, true));
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️ Approximate term search failed:`, error);
        }

        // Strategy 3: Spelling suggestions
        try {
            console.log(`📝 Trying spelling suggestions...`);
            const spellResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(query)}`);
            const spellData = await spellResponse.json();

            if (spellData.suggestionGroup?.suggestionList?.suggestion) {
                const suggestions = Array.isArray(spellData.suggestionGroup.suggestionList.suggestion)
                    ? spellData.suggestionGroup.suggestionList.suggestion
                    : [spellData.suggestionGroup.suggestionList.suggestion];

                console.log(`✅ Found ${suggestions.length} spelling suggestions`);

                for (const suggestion of suggestions.slice(0, 8)) {
                    const suggestionName = suggestion.toLowerCase();
                    if (!seenNames.has(suggestionName)) {
                        seenNames.add(suggestionName);

                        // Get RXCUI for the suggestion
                        const suggestionRxcuiResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(suggestion)}&search=1`);
                        const suggestionRxcuiData = await suggestionRxcuiResponse.json();

                        if (suggestionRxcuiData.idGroup?.rxnormId) {
                            const rxcuis = Array.isArray(suggestionRxcuiData.idGroup.rxnormId)
                                ? suggestionRxcuiData.idGroup.rxnormId
                                : [suggestionRxcuiData.idGroup.rxnormId];

                            const firstRxcui = rxcuis[0];
                            const details = await getRxNormDetails(firstRxcui);

                            if (details) {
                                results.push(createMedicationResult(details, firstRxcui, 85, true));
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️ Spelling suggestions failed:`, error);
        }

        // Strategy 4: Related concepts search if we have partial results
        if (results.length > 0 && results.length < 5) {
            try {
                console.log(`🔗 Trying related concepts search...`);
                const firstResult = results[0];
                if (firstResult.rxcui) {
                    const relatedResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui/${firstResult.rxcui}/related.json?tty=BN+SBD+GPCK+IN`);
                    const relatedData = await relatedResponse.json();

                    if (relatedData.relatedGroup?.conceptGroup) {
                        const conceptGroups = Array.isArray(relatedData.relatedGroup.conceptGroup)
                            ? relatedData.relatedGroup.conceptGroup
                            : [relatedData.relatedGroup.conceptGroup];

                        conceptGroups.forEach((group: any) => {
                            if (group.conceptProperties && results.length < 8) {
                                const concepts = Array.isArray(group.conceptProperties)
                                    ? group.conceptProperties
                                    : [group.conceptProperties];

                                concepts.slice(0, 3).forEach((concept: any) => {
                                    const conceptName = concept.name.toLowerCase();
                                    if (!seenNames.has(conceptName)) {
                                        seenNames.add(conceptName);
                                        results.push(createMedicationResult({
                                            name: concept.name,
                                            generic_names: [], // Let OpenFDA determine what's generic
                                            brand_names: [concept.name], // Treat concept names as brand names initially
                                            drug_class: [],
                                            dosage_forms: []
                                        }, concept.rxcui, 75, true));
                                    }
                                });
                            }
                        });
                    }
                }
            } catch (error) {
                console.log(`⚠️ Related concepts search failed:`, error);
            }
        }

        // Sort by search score (higher is better) and limit results
        results.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
        const uniqueResults = results.slice(0, 8);

        console.log(`🎯 Final RxNorm results for "${query}":`, uniqueResults.map(r => `${r.title} (score: ${r.searchScore})`));

        return uniqueResults;

    } catch (error) {
        console.error('🚨 RxNorm API search completely failed:', error);
        return [];
    }
}

/**
 * Create a standardized medication result object
 */
function createMedicationResult(details: any, rxcui: string, score: number, isFromAPI: boolean): any {
    return {
        title: details.name || 'Unknown',
        name: details.name || 'Unknown',
        generic_names: details.generic_names || [], // Start with empty, let OpenFDA fill this
        brand_names: details.brand_names || [details.name || 'Unknown'], // Include the main name as a brand name by default
        drug_class: details.drug_class || [],
        approved_use: [],
        mechanism_of_action: "Consult medical references and prescribing information",
        dosage_forms: details.dosage_forms || [],
        standard_dosage: "Consult prescribing information for dosing guidelines",
        side_effects: {
            common: [],
            serious: []
        },
        contraindications: [],
        warnings: [],
        interactions: [],
        approval_date: "",
        manufacturer: "",
        source: `https://www.drugs.com/${(details.name || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-')}.html`,
        rxcui: rxcui,
        isFromAPI: isFromAPI,
        searchScore: score
    };
}

/**
 * Get detailed information from RxNorm for a specific RXCUI
 */
async function getRxNormDetails(rxcui: string): Promise<any> {
    try {
        console.log(`📋 Getting details for RXCUI: ${rxcui}`);

        // Get basic drug properties
        const propsResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`);
        const propsData = await propsResponse.json();

        if (!propsData.properties) {
            console.log(`⚠️ No properties found for RXCUI: ${rxcui}`);
            return null;
        }

        const props = propsData.properties;
        const name = props.name || '';

        console.log(`✅ Found basic properties for: ${name}`);

        // Get related drugs (brand names, generic forms, etc.)
        const relatedResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=BN+SBD+GPCK+IN+MIN`);
        const relatedData = await relatedResponse.json();

        const brandNames: string[] = [];
        const dosageForms: string[] = [];

        if (relatedData.relatedGroup?.conceptGroup) {
            const conceptGroups = Array.isArray(relatedData.relatedGroup.conceptGroup)
                ? relatedData.relatedGroup.conceptGroup
                : [relatedData.relatedGroup.conceptGroup];

            conceptGroups.forEach((group: any) => {
                if (group.conceptProperties) {
                    const concepts = Array.isArray(group.conceptProperties)
                        ? group.conceptProperties
                        : [group.conceptProperties];

                    concepts.forEach((concept: any) => {
                        if (concept.name) {
                            // Collect brand names (BN = Brand Name)
                            if (concept.tty === 'BN' && !brandNames.includes(concept.name)) {
                                brandNames.push(concept.name);
                            }
                            // Collect dosage forms from various concept types
                            if ((concept.tty === 'SBD' || concept.tty === 'GPCK') && concept.name.includes(' ')) {
                                const formMatch = concept.name.match(/\b(tablet|capsule|injection|liquid|cream|ointment|gel|solution|suspension|powder|spray|patch|suppository)\b/i);
                                if (formMatch && !dosageForms.includes(formMatch[1])) {
                                    dosageForms.push(formMatch[1]);
                                }
                            }
                        }
                    });
                }
            });
        }

        // If no brand names found, use the original name
        if (brandNames.length === 0) {
            brandNames.push(name);
        }

        console.log(`📊 Details for ${name}: ${brandNames.length} brand names, ${dosageForms.length} dosage forms`);

        return {
            name: name,
            generic_names: [], // Don't assume RxNorm name is generic - let OpenFDA provide the real generic name
            brand_names: brandNames, // Include all brand names including the main name if it's a brand
            drug_class: [],
            dosage_forms: dosageForms
        };

    } catch (error) {
        console.error(`❌ Error getting RxNorm details for RXCUI ${rxcui}:`, error);
        return null;
    }
}

/**
 * Generate a medication note for Obsidian vault.
 * @param {any} medicationData - Selected medication data from database
 * @param {string} medicationsFolder - Path to medications folder from settings
 * @param {App} app - Obsidian App instance
 * @param {boolean} allowOverwrite - Whether to overwrite existing files (default: false)
 */
export async function generateMedicationNote(medicationData: any, medicationsFolder: string, app: App, allowOverwrite: boolean = false): Promise<string> {
    const medData = { ...medicationData };

    // Ensure the title is properly capitalized (Title Case)
    if (medData.title) {
        medData.title = medData.title
            .toLowerCase()
            .replace(/\b\w/g, (l: string) => l.toUpperCase()); // Capitalize first letter of each word
        console.log(`🔤 Formatted title to Title Case: "${medData.title}"`);
    }

    // Try to get additional information from OpenFDA
    console.log(`🔄 Enriching medication data for: ${medData.title}`);
    const fdaData = await getOpenFDADetails(medData.title);

    // Merge FDA data if available
    if (fdaData) {
        console.log(`✅ Enriched with FDA data`);

        // Use FDA drug class
        medData.drug_class = fdaData.drug_class && fdaData.drug_class.length > 0 ? fdaData.drug_class : medData.drug_class;

        // Merge generic names from FDA
        if (fdaData.generic_names && fdaData.generic_names.length > 0) {
            console.log(`📝 Adding OpenFDA generic names: ${fdaData.generic_names.join(', ')}`);
            medData.generic_names = [...(medData.generic_names || []), ...fdaData.generic_names]
                .filter((name, index, arr) => arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index); // Remove duplicates
        }

        // Merge brand names from FDA
        if (fdaData.brand_names && fdaData.brand_names.length > 0) {
            console.log(`📝 Adding OpenFDA brand names: ${fdaData.brand_names.join(', ')}`);
            medData.brand_names = [...(medData.brand_names || []), ...fdaData.brand_names]
                .filter((name, index, arr) => arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index); // Remove duplicates
        } else {
            // If OpenFDA doesn't have brand names but we have a title that looks like a brand name,
            // and we got generic names from OpenFDA, then the title is likely a brand name
            if (medData.generic_names && medData.generic_names.length > 0) {
                const titleInGeneric = medData.generic_names.some((g: string) => g.toLowerCase() === medData.title.toLowerCase());
                if (!titleInGeneric) {
                    // Title is not in generic names, so it's probably a brand name
                    medData.brand_names = [...(medData.brand_names || []), medData.title]
                        .filter((name, index, arr) => arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index);
                }
            }
        }

        // Remove any brand names that appear in generic names (FDA data can be inconsistent)
        if (medData.generic_names && medData.brand_names) {
            const genericNamesLower = medData.generic_names.map((name: string) => name.toLowerCase());
            medData.brand_names = medData.brand_names.filter((brandName: string) => 
                !genericNamesLower.includes(brandName.toLowerCase())
            );
            console.log(`🧹 Cleaned brand names to remove generic duplicates: [${medData.brand_names.join(', ')}]`);
        }

        // Use FDA description if available
        if (fdaData.what_is_description) {
            console.log(`📝 Using OpenFDA description: "${fdaData.what_is_description.substring(0, 50)}..."`);
            medData.what_is_description = fdaData.what_is_description;
        }
    }

    // Create combined aliases from generic names and brand names (excluding the title)
    const allAliases = [
        ...(medData.generic_names || []),
        ...(medData.brand_names || [])
    ].filter((name, index, arr) =>
        name && // Not empty
        name.toLowerCase() !== medData.title.toLowerCase() && // Not the same as title (to avoid duplication in aliases)
        arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index // Remove duplicates within aliases
    );

    console.log(`🔧 Final generic_names: [${(medData.generic_names || []).join(', ')}]`);
    console.log(`🔧 Final brand_names: [${(medData.brand_names || []).join(', ')}]`);
    console.log(`🔧 Final aliases: [${allAliases.join(', ')}]`);
    console.log(`🔧 Final medData.what_is_description: ${medData.what_is_description ? 'present' : 'missing'}`);

    const yamlFrontmatter = `---
title: ${medData.title}
${medData.generic_names && medData.generic_names.length > 0 ? `generic_names:\n${medData.generic_names.map((name: string) => `  - ${name}`).join('\n')}` : ''}
${medData.brand_names && medData.brand_names.length > 0 ? `brand_names:\n${medData.brand_names.map((name: string) => `  - ${name}`).join('\n')}` : ''}
${allAliases.length > 0 ? `aliases:\n${allAliases.map((name: string) => `  - ${name}`).join('\n')}` : ''}
${medData.dosage_forms && medData.dosage_forms.length > 0 ? `dosage_forms:\n${medData.dosage_forms.map((form: string) => `  - ${form}`).join('\n')}` : ''}
${medData.drug_class && medData.drug_class.length > 0 ? `drug_class:\n${medData.drug_class.map((cls: string) => `  - ${cls}`).join('\n')}` : ''}
---`;

    // Create note body with description and links
    const drugsComUrl = `https://www.drugs.com/${medData.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.html`;
    const goodRxUrl = `https://www.goodrx.com/${medData.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}/what-is`;

    let noteBody = `# ${medData.title}\n\n`;

    // Add description if available
    if (medData.what_is_description) {
        noteBody += `${medData.what_is_description}\n\n`;
    }

    // Add resource links
    noteBody += `## Additional Resources\n\n`;
    noteBody += `- [Drugs.com - Complete Drug Information](${drugsComUrl})\n`;
    noteBody += `- [GoodRx - What is ${medData.title}?](${goodRxUrl})\n`;

    const fileName = `${medData.title}.md`;
    const fileContent = `${yamlFrontmatter}\n${noteBody}`;

    try {
        // Ensure the medications folder exists
        const normalizedPath = normalizePath(medicationsFolder);
        const folder = app.vault.getAbstractFileByPath(normalizedPath);
        if (!folder) {
            await app.vault.createFolder(normalizedPath);
        }

        // Create the medication note - handle existing files based on allowOverwrite flag
        const filePath = normalizePath(`${medicationsFolder}/${fileName}`);
        
        // First, try to find existing file with exact case
        let existingFile = app.vault.getAbstractFileByPath(filePath);
        
        // If not found, search for case-insensitive match
        if (!existingFile) {
            const allFiles = app.vault.getMarkdownFiles();
            const targetDir = normalizePath(medicationsFolder);
            existingFile = allFiles.find(file => 
                file.path.toLowerCase() === filePath.toLowerCase() &&
                file.path.startsWith(targetDir)
            ) || null;
            
            if (existingFile) {
                console.log(`🔍 Found case-insensitive match: ${existingFile.path} for ${filePath}`);
            }
        }
        
        console.log(`🔍 Checking for existing file at: ${filePath}`);
        console.log(`🔍 Existing file found: ${existingFile ? 'YES' : 'NO'}`);
        if (existingFile) {
            console.log(`🔍 Existing file path: ${existingFile.path}`);
        }
        console.log(`🔍 Allow overwrite: ${allowOverwrite}`);
        
        if (existingFile) {
            if (allowOverwrite) {
                console.log(`📝 File already exists, overwriting: ${fileName}`);
                // Overwrite existing file
                await app.vault.modify(existingFile as any, fileContent);
                console.log(`✅ Medication note updated: ${fileName}`);
            } else {
                // Don't overwrite, show notification and return existing file path
                console.log(`⚠️ File already exists, not overwriting: ${fileName}`);
                throw new Error(`Medication note already exists: ${fileName}`);
            }
        } else {
            // Create new file
            console.log(`📝 Creating new file: ${fileName}`);
            try {
                await app.vault.create(filePath, fileContent);
                console.log(`✅ Medication note created: ${fileName}`);
            } catch (createError: any) {
                console.log(`❌ Error creating file: ${createError.message}`);
                // Check if this is a "file already exists" error from Obsidian
                if (createError.message && createError.message.toLowerCase().includes('already exists')) {
                    if (allowOverwrite) {
                        console.log(`📝 File exists, trying to overwrite via modify...`);
                        
                        // Try to find the existing file again (might be case sensitivity issue)
                        let existingFileRetry = app.vault.getAbstractFileByPath(filePath);
                        if (!existingFileRetry) {
                            // Search case-insensitively
                            const allFiles = app.vault.getMarkdownFiles();
                            const targetDir = normalizePath(medicationsFolder);
                            existingFileRetry = allFiles.find(file => 
                                file.path.toLowerCase() === filePath.toLowerCase() &&
                                file.path.startsWith(targetDir)
                            ) || null;
                            
                            if (existingFileRetry) {
                                console.log(`📝 Found existing file via case-insensitive search: ${existingFileRetry.path}`);
                            }
                        }
                        
                        if (existingFileRetry) {
                            await app.vault.modify(existingFileRetry as any, fileContent);
                            console.log(`✅ Medication note updated via retry: ${existingFileRetry.name}`);
                            return existingFileRetry.path; // Return the actual file path
                        } else {
                            throw new Error(`Could not find file to overwrite: ${fileName}`);
                        }
                    } else {
                        throw new Error(`Medication note already exists: ${fileName}`);
                    }
                } else {
                    // Re-throw other errors
                    throw createError;
                }
            }
        }
        
        return filePath;
    } catch (err) {
        console.error(`❌ Failed to create medication note:`, err);
        throw err;
    }
}