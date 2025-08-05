// Test our new clean description function
const indication = "1 INDICATIONS AND USAGE ABILIFY (aripiprazole) Tablets are indicated for the treatment of: Schizophrenia Acute Treatment of Manic and Mixed Episodes associated with Bipolar I Disorder Adjunctive Treatment of Major Depressive Disorder Irritability Associated with Autistic Disorder Treatment of Tourette's Disorder ABILIFY is an atypical antipsychotic";

function createCleanDescription(indication) {
    try {
        let clean = indication
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();

        clean = clean.replace(/^\d+(\.\d+)?\s+[A-Z\s]+(?=\s+[A-Z][a-z])/g, '');

        const treatmentMatch = clean.match(/(?:indicated for|used for|treatment of):\s*(.+?)(?:\s+[A-Z][A-Z]+\s+is|$)/i);

        if (treatmentMatch) {
            let conditions = treatmentMatch[1].trim();

            conditions = conditions
                .replace(/\s+Acute Treatment of\s+/g, ', acute episodes of ')
                .replace(/\s+Adjunctive Treatment of\s+/g, ', as add-on treatment for ')
                .replace(/\s+associated with\s+/gi, ' in people with ')
                .replace(/Major Depressive Disorder/g, 'major depression')
                .replace(/Bipolar I Disorder/g, 'bipolar disorder')
                .replace(/Autistic Disorder/g, 'autism')
                .replace(/Tourette\'s Disorder/g, 'Tourette\'s syndrome');

            return `Used to treat ${conditions.toLowerCase()}.`;
        }

        return '';
    } catch (error) {
        return '';
    }
}

console.log('Original:', indication.substring(0, 100) + '...');
console.log('Clean result:', createCleanDescription(indication));
