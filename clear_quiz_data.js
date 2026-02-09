// Clear all quiz progress data
localStorage.removeItem('quiz_progress:TypeScript:Type System Basics');
localStorage.removeItem('quiz_progress:Aws SAA:AWS Identity and Access Management (IAM)');

// Clear any other quiz progress keys
Object.keys(localStorage).forEach(key => {
    if (key.startsWith('quiz_progress:')) {
        localStorage.removeItem(key);
    }
});

console.log('All quiz progress cleared');
