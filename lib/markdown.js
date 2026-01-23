const { marked } = require('marked');

/**
 * Sanitize HTML to ensure it's valid and Asana-compatible
 * Escapes orphaned < and > characters that aren't part of valid HTML tags
 * @param {string} html - HTML string
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html) {
    // List of HTML tags Asana supports (NOTE: Asana only supports h1 and h2, not h3-h6!)
    const asanaTags = ['body', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'pre', 'code', 'a', 'br', 'hr', 'h1', 'h2', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
    
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
    
    // Track Asana-specific replacements to apply after markdown processing
    const asanaReplacements = [];
    
    // FIRST: Handle markdown links to Asana user profiles (before bare URLs)
    // [Name](https://app.asana.com/0/profile/USER_GID) - explicit profile URL
    // -> placeholder for <a data-asana-gid="USER_GID" data-asana-type="user">Name</a>
    markdown = markdown.replace(/\[([^\]]+)\]\(https:\/\/app\.asana\.com\/0\/profile\/(\d+)(?:[\/\?][^\)]*)?\)/g, (match, name, gid) => {
        const placeholder = `ASANA-MENTION-PLACEHOLDER-${asanaReplacements.length}-END`;
        asanaReplacements.push({
            placeholder,
            replacement: `<a data-asana-gid="${gid}" data-asana-type="user">${name}</a>`
        });
        return placeholder;
    });
    
    // Handle markdown links to Asana tasks/projects (before bare URLs)
    // [Text](https://app.asana.com/...) -> keep as markdown link, marked() will convert it
    // Don't create placeholder for these, let marked() handle them normally
    
    // Convert bare user profile URLs to proper mention format (NOT inside markdown links)
    // Only match /profile/ URLs to avoid false matches with project/task URLs
    markdown = markdown.replace(/https:\/\/app\.asana\.com\/0\/profile\/(\d+)(?:[\/\?]\S*)?(?![^\[]*\])/g, (match, gid) => {
        const placeholder = `ASANA-MENTION-PLACEHOLDER-${asanaReplacements.length}-END`;
        asanaReplacements.push({
            placeholder,
            replacement: `<a data-asana-gid="${gid}" data-asana-type="user"></a>`
        });
        return placeholder;
    });
    
    // Note: Bare Asana task/project URLs will be handled by marked() as autolinks
    // marked() with gfm:true will convert them to <a href="...">...</a> automatically
    
    // Configure marked
    marked.setOptions({
        breaks: true,  
        gfm: true,
        tables: true  // Enable GFM table support
    });
    
    // Pre-process markdown to preserve blank line information in lists
    // Insert a special marker comment where there are blank lines between list items
    const LIST_SPLIT_MARKER = '<!---LIST_SPLIT--->';
    markdown = markdown.replace(/^([-*]\s+.*)$\n\n(?=[-*]\s+)/gm, `$1\n${LIST_SPLIT_MARKER}\n`);
    
    // Convert markdown to HTML
    let html = marked.parse(markdown);
    
    // Restore Asana-specific replacements (mentions and URLs)
    asanaReplacements.forEach(({ placeholder, replacement }) => {
        const placeholderRegex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        html = html.replace(placeholderRegex, replacement);
    });
    
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
    
    // Remove start attribute from <ol> tags (Asana doesn't support it)
    html = html.replace(/<ol start="\d+">/g, '<ol>');
    
    // Convert tables to Asana's format
    // Asana supports tables but not thead/tbody/th - only table/tr/td with specific attributes
    html = html.replace(/<table>[\s\S]*?<\/table>/g, (match) => {
        // Remove thead, tbody tags and convert th to td
        let tableHtml = match
            .replace(/<\/?thead>/g, '')
            .replace(/<\/?tbody>/g, '')
            .replace(/<th([^>]*)>/g, '<td$1>')
            .replace(/<\/th>/g, '</td>');
        
        // Add required attributes to td elements
        tableHtml = tableHtml.replace(/<td([^>]*)>/g, '<td width="120" data-cell-widths="120"$1>');
        
        return tableHtml;
    });
    
    // Asana DOES support HTML lists and code blocks, so keep <ul>, <li>, <pre>, <code> tags!
    // Convert <br> to newlines (Asana prefers actual newlines)
    html = html.replace(/<br\s*\/?>/gi, '\n');
    
    // Make hr tags self-closing for valid XML
    html = html.replace(/<hr>/g, '<hr/>');
    
    // Convert h3-h6 to h2 (Asana only supports h1 and h2)
    html = html.replace(/<h[3-6]>/g, '<h2>');
    html = html.replace(/<\/h[3-6]>/g, '</h2>');
    
    // Remove <p> tags (Asana doesn't support them - use bare text instead)
    // Special handling: paragraphs immediately after headers (no extra spacing between them)
    html = html.replace(/(<\/h[12]>)\s*<p>([\s\S]*?)<\/p>/g, '$1$2\n');
    // Remove newlines between consecutive headers
    html = html.replace(/(<\/h[12]>)\s+(<h[12]>)/g, '$1$2');
    // Remove newlines between headers and lists
    html = html.replace(/(<\/h[12]>)\s+(<ul>|<ol>)/g, '$1$2');
    // Then remove remaining <p> tags with double newline for paragraph spacing
    html = html.replace(/<p>/g, '');
    html = html.replace(/<\/p>/g, '\n\n');
    
    // Remove the LIST_SPLIT_MARKER comments (marked already split the lists for us)
    // Note: Clean up any whitespace around the markers
    html = html.replace(/\s*<!---LIST_SPLIT--->\s*/g, '\n');
    
    // Remove extra newlines before block elements (ul, ol, pre)
    html = html.replace(/\n\n+(<ul>|<ol>|<pre>)/g, '\n$1');
    
    // Remove extra newlines after block elements
    html = html.replace(/(<\/ul>|<\/ol>|<\/pre>)\n+/g, '$1\n');
    
    // Remove newlines between block elements and headers (no spacing between sections)
    html = html.replace(/(<\/ul>|<\/ol>|<\/pre>)\s+(<h[12]>)/g, '$1$2');
    
    // Clean up excessive newlines (3+ becomes 2 to preserve intentional blank lines)
    html = html.replace(/\n\n\n+/g, '\n\n');
    
    // Remove leading/trailing newlines
    html = html.trim();
    
    // Final sanitization to catch any malformed tags (do this AFTER all transformations)
    html = sanitizeHtml(html);
    
    // Wrap in body tag (Asana requires this)
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
