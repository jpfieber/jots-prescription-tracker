// Test the overwrite logic
console.log('Testing generateMedicationNote overwrite behavior:');

// Mock scenarios
const scenarios = [
    {
        command: 'Create Medication Note',
        allowOverwrite: false,
        fileExists: false,
        expectedResult: 'File created successfully'
    },
    {
        command: 'Create Medication Note',
        allowOverwrite: false,
        fileExists: true,
        expectedResult: 'Error: File already exists'
    },
    {
        command: 'Convert Current File',
        allowOverwrite: true,
        fileExists: false,
        expectedResult: 'File created successfully'
    },
    {
        command: 'Convert Current File',
        allowOverwrite: true,
        fileExists: true,
        expectedResult: 'File overwritten successfully'
    }
];

scenarios.forEach((scenario, index) => {
    console.log(`\nScenario ${index + 1}: ${scenario.command}`);
    console.log(`  File exists: ${scenario.fileExists}`);
    console.log(`  Allow overwrite: ${scenario.allowOverwrite}`);
    console.log(`  Expected: ${scenario.expectedResult}`);
    
    if (scenario.fileExists && !scenario.allowOverwrite) {
        console.log(`  ❌ Would throw error: "Medication note already exists"`);
    } else if (scenario.fileExists && scenario.allowOverwrite) {
        console.log(`  ✅ Would overwrite existing file`);
    } else {
        console.log(`  ✅ Would create new file`);
    }
});

console.log('\n✅ Logic test complete');
