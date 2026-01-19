const { marked } = require('marked');

/**
 * Sanitize HTML to ensure it's valid and Asana-compatible
 * Escapes orphaned < and > characters that aren't part of valid HTML tags
 * @param {string} html - HTML string
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html) {
    // List of HTML tags Asana supports
    const asanaTags = ['body', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'pre', 'code', 'a', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    
    // Build regex to match valid opening/closing tags
    const tagPattern = new RegExp(`^<(\\/?)(?:${asanaTags.join('|')})(?:\\s|>|\\/)`, 'i');
    
    let result = '';
    let i = 0;
    
    while (i < html.length) {
        if (html[i] === '<') {
            const remaining = html.substring(i);
            const match = remaining.match(tagPattern);
            const closePos = remaining.indexOf('>');
            
            if (closePos === -1) {
                // No closing >, escape the <
                result += '&lt;';
                i++;
            } else if (match) {
                // Valid tag, keep it as-is
                result += remaining.substring(0, closePos + 1);
                i += closePos + 1;
            } else {
                // Invalid/unsupported tag, escape the <
                result += '&lt;';
                i++;
            }
        } else {
            result += html[i];
            i++;
        }
    }
    
    return result;
}

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
    
    // Decode HTML entities that marked generates (Asana will re-encode them, causing double-encoding)
    // Only decode common entities, preserve &lt; &gt; &amp; for actual HTML
    html = html.replace(/&#39;/g, "'");
    html = html.replace(/&quot;/g, '"');
    html = html.replace(/&#x27;/g, "'");
    html = html.replace(/&#x2F;/g, '/');
    
    // Asana code block format: just <pre>, not <pre><code>
    // Remove <code> tags inside <pre> and strip class attributes
    html = html.replace(/<pre><code[^>]*>/g, '<pre>');
    html = html.replace(/<\/code><\/pre>/g, '</pre>');
    
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
    
    // Final sanitization to catch any malformed tags (do this AFTER all transformations)
    html = sanitizeHtml(html);
    
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
            // Note: Do NOT use console.log as it breaks MCP protocol (stdout must be JSON-only)
            // console.error can be used for debugging if needed (goes to stderr)
        }
    }
    
    return processedUpdates;
}

module.exports = {
    markdownToAsanaHtml,
    prepareTaskUpdates
};
