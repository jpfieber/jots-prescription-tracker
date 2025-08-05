// Test the updated aliases logic

console.log('=== Test Case 1: Brand Name Title (Abilify) ===');
const brandNameTest = {
    title: "Abilify",
    generic_names: ["Aripiprazole"],
    brand_names: ["Abilify", "ABILIFY", "Abilify ODT"],
    drug_class: ["Atypical Antipsychotic"]
};

const brandAliases = [
    ...(brandNameTest.generic_names || []),
    ...(brandNameTest.brand_names || [])
].filter((name, index, arr) =>
    name && // Not empty
    name.toLowerCase() !== brandNameTest.title.toLowerCase() && // Not the same as title
    arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index // Remove duplicates
);

console.log('Title:', brandNameTest.title);
console.log('Generic Names:', brandNameTest.generic_names);
console.log('Brand Names:', brandNameTest.brand_names);
console.log('Aliases (should exclude title):', brandAliases);

console.log('\n=== Test Case 2: Generic Name Title (Aripiprazole) ===');
const genericNameTest = {
    title: "Aripiprazole",
    generic_names: ["Aripiprazole", "aripiprazole"],
    brand_names: ["Abilify", "ABILIFY", "Abilify ODT"],
    drug_class: ["Atypical Antipsychotic"]
};

const genericAliases = [
    ...(genericNameTest.generic_names || []),
    ...(genericNameTest.brand_names || [])
].filter((name, index, arr) =>
    name && // Not empty
    name.toLowerCase() !== genericNameTest.title.toLowerCase() && // Not the same as title
    arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index // Remove duplicates
);

console.log('Title:', genericNameTest.title);
console.log('Generic Names:', genericNameTest.generic_names);
console.log('Brand Names:', genericNameTest.brand_names);
console.log('Aliases (should exclude title):', genericAliases);

console.log('\n=== Expected Results ===');
console.log('For brand name title: aliases should contain generic name and other brand names');
console.log('For generic name title: aliases should contain brand names but not duplicate generic names');
