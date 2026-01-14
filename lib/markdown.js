const { marked } = require('marked');

/**
 * Convert markdown to Asana-compatible HTML
 * @param {string} markdown - Markdown text
 * @returns {string} HTML wrapped in <body> tag for Asana
 */
function markdownToAsanaHtml(markdown) {
    if (!markdown) return '';
    
    // Configure marked
    marked.setOptions({
        breaks: true,  
        gfm: true
    });
    
    // Convert markdown to HTML
    let html = marked(markdown);
    
    // Asana has limited HTML support and doesn't like <br> tags!
    // It prefers actual newlines in the HTML string
    
    // Convert ALL <br> variants to newlines first
    html = html.replace(/<br\s*\/?>/gi, '\n');
    
    // Remove <ul> and </ul> tags
    html = html.replace(/<\/?ul>/g, '');
    html = html.replace(/<\/?ol>/g, '');
    
    // Convert list items to plain text with newlines
    html = html.replace(/<li>/g, '').replace(/<\/li>/g, '\n');
    
    // Remove <p> tags and replace with newlines
    html = html.replace(/<p>/g, '').replace(/<\/p>/g, '\n');
    
    // Clean up multiple consecutive newlines
    html = html.replace(/\n\n+/g, '\n');
    
    // Remove leading/trailing newlines
    html = html.trim();
    
    // Wrap in body tag
    if (!html.startsWith('<body>')) {
        html = `<body>${html}</body>`;
    }
    
    return html;
}

/**
 * Prepare task updates with proper formatting
 * @param {Object} updates - Task update object
 * @returns {Object} Processed updates with html_notes if notes contains markdown
 */
function prepareTaskUpdates(updates) {
    const processedUpdates = { ...updates };
    
    // If updating notes and it contains markdown-like syntax, convert to html_notes
    if (processedUpdates.notes) {
        const hasMarkdown = /[*_#\[\]`]/.test(processedUpdates.notes);
        
        if (hasMarkdown) {
            // Convert to HTML and use html_notes instead
            processedUpdates.html_notes = markdownToAsanaHtml(processedUpdates.notes);
            delete processedUpdates.notes;
            console.log('ℹ️  Detected markdown formatting, converting to HTML...');
        }
    }
    
    return processedUpdates;
}

module.exports = {
    markdownToAsanaHtml,
    prepareTaskUpdates
};
