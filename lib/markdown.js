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
    
    // Asana DOES support HTML lists and code blocks, so keep <ul>, <li>, <pre>, <code> tags!
    // Convert <br> to newlines (Asana prefers actual newlines)
    html = html.replace(/<br\s*\/?>/gi, '\n');
    
    // Remove <p> tags and replace closing tags with single newline
    html = html.replace(/<p>/g, '').replace(/<\/p>/g, '\n');
    
    // Remove extra newlines before block elements (ul, ol, pre)
    html = html.replace(/\n+(<ul>|<ol>|<pre>)/g, '$1');
    
    // Remove extra newlines after block elements
    html = html.replace(/(<\/ul>|<\/ol>|<\/pre>)\n+/g, '$1\n');
    
    // Clean up excessive newlines (3+ becomes 2 to preserve intentional blank lines)
    html = html.replace(/\n\n\n+/g, '\n\n');
    
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
