/**
 * Display and formatting utilities
 */

/**
 * Display tasks in a formatted way
 * @param {Array} tasks - Array of task objects
 */
function displayTasks(tasks) {
    if (!tasks || tasks.length === 0) {
        console.log('No tasks found.');
        return;
    }

    console.log(`\n📋 Found ${tasks.length} task(s):\n`);
    tasks.forEach((task, index) => {
        const status = task.completed ? '✅' : '⬜';
        const dueDate = task.due_on || task.due_at || 'No due date';
        console.log(`${index + 1}. ${status} ${task.name}`);
        console.log(`   GID: ${task.gid}`);
        console.log(`   Due: ${dueDate}`);
        if (task.projects && task.projects.length > 0) {
            console.log(`   Projects: ${task.projects.map(p => p.name).join(', ')}`);
        }
        console.log('');
    });
}

/**
 * Display a single task with detailed information
 * @param {Object} task - Task object
 */
function displayTaskDetails(task, options = {}) {
    if (!task) {
        console.log('No task data provided.');
        return;
    }
    
    const noteFormat = options.noteFormat || 'markdown';

    console.log(`\n📝 Task Details:\n`);
    console.log(`Name: ${task.name}`);
    console.log(`GID: ${task.gid}`);
    console.log(`Status: ${task.completed ? '✅ Completed' : '⬜ Incomplete'}`);
    
    if (task.assignee) {
        const assigneeGid = task.assignee.gid ? ` (${task.assignee.gid})` : '';
        console.log(`Assignee: ${task.assignee.name || 'Unassigned'}${assigneeGid}`);
    } else {
        console.log(`Assignee: Unassigned`);
    }
    
    if (task.start_on) {
        console.log(`Start: ${task.start_on}`);
    }
    console.log(`Due: ${task.due_on || task.due_at || 'No due date'}`);
    
    if (task.parent) {
        const parentGid = task.parent.gid ? ` (GID: ${task.parent.gid})` : '';
        console.log(`Parent Task: ${task.parent.name}${parentGid}`);
    }
    
    if (task.projects && task.projects.length > 0) {
        console.log(`\nProjects:`);
        task.projects.forEach(p => {
            console.log(`  - ${p.name} (GID: ${p.gid})`);
        });
    }
    
    if (task.tags && task.tags.length > 0) {
        console.log(`\nTags:`);
        task.tags.forEach(t => {
            console.log(`  - ${t.name} (GID: ${t.gid})`);
        });
    }
    
    if (task.subtasks && task.subtasks.length > 0) {
        console.log(`\nSubtasks (${task.subtasks.length}):`);
        task.subtasks.forEach(st => {
            const status = st.completed ? '✅' : '⬜';
            console.log(`  ${status} ${st.name} (GID: ${st.gid})`);
        });
    }
    
    if (task.num_hearts || task.num_likes) {
        console.log(`\n❤️  Likes: ${task.num_hearts || task.num_likes || 0}`);
    }
    
    if (task.commentCount !== undefined) {
        console.log(`💬 Comments: ${task.commentCount}`);
    }
    
    // Display notes in the requested format
    if (noteFormat === 'html' && task.html_notes) {
        // Show raw HTML
        console.log(`\nNotes (HTML):\n${task.html_notes}`);
    } else if (noteFormat === 'raw' && task.notes) {
        // Show raw plain text from notes field
        console.log(`\nNotes (Raw):\n${task.notes}`);
    } else if (task.html_notes) {
        // Default: Convert HTML to markdown for terminal display
        let readableNotes = task.html_notes
            // Remove body tags
            .replace(/<body>|<\/body>/g, '')
            // Convert headers
            .replace(/<h1>(.*?)<\/h1>/gi, '\n# $1\n')
            .replace(/<h2>(.*?)<\/h2>/gi, '\n## $1\n')
            // Convert blockquotes
            .replace(/<blockquote>(.*?)<\/blockquote>/gis, (m, content) => {
                // Remove tags from content and add > prefix to each line
                const cleaned = content.replace(/<[^>]+>/g, '').trim();
                return '\n> ' + cleaned.split('\n').map(line => line.trim()).filter(line => line).join('\n> ') + '\n';
            })
            // Convert list structures
            .replace(/<ul>/gi, '\n')
            .replace(/<\/ul>/gi, '\n')
            .replace(/<ol>/gi, '\n')
            .replace(/<\/ol>/gi, '\n')
            .replace(/<li>/gi, '- ')
            .replace(/<\/li>/gi, '\n')
            // Convert tables (basic - just extract content)
            .replace(/<table[^>]*>/gi, '\n')
            .replace(/<\/table>/gi, '\n')
            .replace(/<tr>/gi, '')
            .replace(/<\/tr>/gi, '\n')
            .replace(/<td[^>]*>/gi, '| ')
            .replace(/<\/td>/gi, ' ')
            // Convert code blocks (preserve content, handle newlines)
            .replace(/<pre>(.*?)<\/pre>/gis, (m, code) => {
                const cleanCode = code.replace(/<[^>]+>/g, '');
                return `\n\`\`\`\n${cleanCode}\n\`\`\`\n`;
            })
            // Convert inline formatting
            .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
            .replace(/<b>(.*?)<\/b>/g, '**$1**')
            .replace(/<em>(.*?)<\/em>/g, '*$1*')
            .replace(/<i>(.*?)<\/i>/g, '*$1*')
            .replace(/<u>(.*?)<\/u>/g, '_$1_')
            .replace(/<code>(.*?)<\/code>/g, '`$1`')
            .replace(/<del>(.*?)<\/del>/g, '~~$1~~')
            .replace(/<s>(.*?)<\/s>/g, '~~$1~~')
            .replace(/<strike>(.*?)<\/strike>/g, '~~$1~~')
            // Convert links - handle Asana user mentions and regular links
            .replace(/<a[^>]*data-asana-type="user"[^>]*>(.*?)<\/a>/g, '@$1')
            .replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
            // Convert <hr> to separator
            .replace(/<hr\s*\/?>/gi, '\n---\n')
            // Clean up remaining HTML tags
            .replace(/<[^>]+>/g, '')
            // Decode HTML entities
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            // Clean up excessive newlines and spaces
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\|\s+\|/g, '| ')
            .trim();
        
        console.log(`\nNotes:\n${readableNotes}`);
    } else if (task.notes) {
        console.log(`\nNotes:\n${task.notes}`);
    }
    
    if (task.tags && task.tags.length > 0) {
        console.log(`Tags: ${task.tags.map(t => t.name).join(', ')}`);
    }
    
    console.log('');
}

/**
 * Display user information
 * @param {Object} user - User object
 */
function displayUserInfo(user) {
    if (!user) {
        console.log('No user data provided.');
        return;
    }

    console.log(`\n👤 User Information:\n`);
    console.log(`Name: ${user.name}`);
    console.log(`Email: ${user.email || 'N/A'}`);
    console.log(`GID: ${user.gid}`);
    
    if (user.workspaces && user.workspaces.length > 0) {
        console.log(`\nWorkspaces:`);
        user.workspaces.forEach((ws, index) => {
            console.log(`  ${index + 1}. ${ws.name} (${ws.gid})`);
        });
    }
    
    console.log('');
}

module.exports = {
    displayTasks,
    displayTaskDetails,
    displayUserInfo
};
