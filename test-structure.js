// Test the new name structure
const testData = {
    title: "Abilify",
    generic_names: ["Aripiprazole"],
    brand_names: ["ABILIFY", "Abilify ODT"],
    drug_class: ["Atypical Antipsychotic"],
    dosage_forms: ["tablet", "injection"],
    what_is_description: "Used to treat schizophrenia, acute episodes of manic and mixed episodes in people with bipolar disorder."
};

// Simulate the alias creation logic
const allAliases = [
    ...(testData.generic_names || []),
    ...(testData.brand_names || [])
].filter((name, index, arr) =>
    name && // Not empty
    name.toLowerCase() !== testData.title.toLowerCase() && // Not the same as title
    arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index // Remove duplicates
);

console.log('Test Data Structure:');
console.log('Title:', testData.title);
console.log('Generic Names:', testData.generic_names);
console.log('Brand Names:', testData.brand_names);
console.log('Combined Aliases:', allAliases);

// Test YAML generation
const yamlFrontmatter = `---
title: ${testData.title}
${testData.generic_names && testData.generic_names.length > 0 ? `generic_names:\n${testData.generic_names.map(name => `  - ${name}`).join('\n')}` : ''}
${testData.brand_names && testData.brand_names.length > 0 ? `brand_names:\n${testData.brand_names.map(name => `  - ${name}`).join('\n')}` : ''}
${allAliases.length > 0 ? `aliases:\n${allAliases.map(name => `  - ${name}`).join('\n')}` : ''}
${testData.dosage_forms && testData.dosage_forms.length > 0 ? `dosage_forms:\n${testData.dosage_forms.map(form => `  - ${form}`).join('\n')}` : ''}
${testData.drug_class && testData.drug_class.length > 0 ? `drug_class:\n${testData.drug_class.map(cls => `  - ${cls}`).join('\n')}` : ''}
---`;

console.log('\nGenerated YAML:');
console.log(yamlFrontmatter);
