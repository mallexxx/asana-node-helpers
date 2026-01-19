/**
 * Asana Node Helpers - Main Entry Point
 * 
 * This is the main entry point for the application.
 * Import and export all modules for easy access.
 */

// Import Node.js modules
const fs = require('fs');
const path = require('path');

// Import feature modules
const { initializeClient } = require('./lib/client');
const { getCurrentUser, getUser } = require('./lib/users');
const { getTasksForUser, getTask, getTaskStories, addTaskComment, createTask, updateTask, addTaskToProject, removeTaskFromProject, searchTasks, displaySearchedTasks } = require('./lib/tasks');
const { displayTasks, displayTaskDetails, displayUserInfo } = require('./lib/display');
const { searchProjects, displayProjects, getSections, displaySections, clearCache } = require('./lib/projects');

// Initialize Asana client (this validates API key)
const {
    client,
    tasksApiInstance,
    usersApiInstance,
    projectsApiInstance,
    workspacesApiInstance,
    storiesApiInstance,
    sectionsApiInstance
} = initializeClient();

// Export everything for use in other modules
module.exports = {
    // API instances
    client,
    tasksApiInstance,
    usersApiInstance,
    projectsApiInstance,
    workspacesApiInstance,
    
    // User functions
    getCurrentUser: () => getCurrentUser(usersApiInstance),
    getUser: (userGid) => getUser(usersApiInstance, userGid),
    
    // Task functions
    getTasksForUser: (userGid, workspace, options) => getTasksForUser(tasksApiInstance, userGid, workspace, options),
    getTask: (taskGid, options) => getTask(tasksApiInstance, taskGid, options),
    getTaskStories: (taskGid, options) => getTaskStories(storiesApiInstance, taskGid, options),
    addTaskComment: (taskGid, commentData, options) => addTaskComment(storiesApiInstance, taskGid, commentData, options),
    createTask: (taskData) => createTask(tasksApiInstance, taskData),
    updateTask: (taskGid, updates) => updateTask(tasksApiInstance, taskGid, updates),
    searchTasks: (searchOptions) => searchTasks(tasksApiInstance, searchOptions),
    displaySearchedTasks,
    
    // Display functions
    displayTasks,
    displayTaskDetails,
    displayUserInfo,
    
    // Project functions
    searchProjects,
    displayProjects
};

// CLI support
if (require.main === module) {
    const command = process.argv[2];
    
    // Valid flags for each command
    const VALID_FLAGS = {
        'projects': ['name', 'archived', 'format', 'fields'],
        'sections': ['project', 'format', 'fields'],
        'search-tasks': [
            'format', 'fields', 'limit',
            'projects', 'projects.any', 'projects.not', 'projects.all',
            'sections', 'sections.any', 'sections.not', 'sections.all',
            'tags', 'tags.any', 'tags.not', 'tags.all',
            'assignee', 'assignee.any', 'assignee.not',
            'teams.any', 'portfolios.any',
            'followers.any', 'followers.not',
            'created_by.any', 'created_by.not',
            'assigned_by.any', 'assigned_by.not',
            'liked_by.not', 'commented_on_by.not',
            'completed', 'is_subtask', 'is_blocked', 'is_blocking', 'has_attachment',
            'due_on', 'due_on.before', 'due_on.after', 'due_at.before', 'due_at.after',
            'start_on', 'start_on.before', 'start_on.after',
            'created_on', 'created_on.before', 'created_on.after', 'created_at.before', 'created_at.after',
            'completed_on', 'completed_on.before', 'completed_on.after', 'completed_at.before', 'completed_at.after',
            'modified_on', 'modified_on.before', 'modified_on.after', 'modified_at.before', 'modified_at.after',
            'text', 'sort_by', 'sort_ascending'
        ],
        'create-task': ['name', 'notes', 'notes-file', 'html_notes', 'html_notes-file', 'assignee', 'projects', 'workspace', 'parent', 'due_on', 'due_at', 'start_on', 'completed', 'markdown'],
        'update-task': ['name', 'notes', 'notes-file', 'html_notes', 'html_notes-file', 'assignee', 'projects', 'parent', 'due_on', 'due_at', 'start_on', 'completed', 'markdown'],
        'add-comment': ['text', 'html_text', 'markdown'],
        'add-to-project': ['project', 'section'],
        'remove-from-project': ['project'],
        'task': ['format']
    };
    
    function validateFlags(command, args) {
        if (!VALID_FLAGS[command]) {
            return { valid: true, invalidFlags: [] };
        }
        
        const validFlags = VALID_FLAGS[command];
        const invalidFlags = [];
        
        for (let i = 0; i < args.length; i++) {
            if (args[i].startsWith('--')) {
                const flag = args[i].substring(2);
                if (!validFlags.includes(flag)) {
                    invalidFlags.push(flag);
                }
            }
        }
        
        return {
            valid: invalidFlags.length === 0,
            invalidFlags
        };
    }
    
    function showHelp() {
        console.log('\n🚀 Asana Node Helpers\n');
        console.log('Usage: node index.js <command> [options]\n');
        console.log('Commands:');
        console.log('  tasks                          - Fetch YOUR incomplete tasks');
        console.log('  completed                      - Fetch YOUR last 20 completed tasks');
        console.log('  task <gid> [--format]          - Get details of a specific task');
        console.log('  task-comments <gid>            - Get comments/discussion for a task');
        console.log('  add-comment <gid> --text <text> - Add a comment to a task');
        console.log('  user                           - Show current user info');
        console.log('  projects [options]             - Search projects in your workspace');
        console.log('  sections <project_gid>         - List sections in a project');
        console.log('  search-tasks [options]         - Search tasks with advanced filters');
        console.log('  create-task --name <name> [options] - Create a new task');
        console.log('  update-task <gid> [options]    - Update an existing task');
        console.log('  add-to-project <task_gid> --project <gid> [--section <gid>] - Add/move task to project/section');
        console.log('  remove-from-project <task_gid> --project <gid> - Remove task from project');
        console.log('  clear-cache                    - Clear projects cache\n');
        console.log('Project search options (use --flag value):');
        console.log('  --name <text>                  - Search by name');
        console.log('  --archived <true|false>        - Filter by archived status');
        console.log('  --format <list|table|json|inline> - Output format (default: list)');
        console.log('  --fields <field1,field2,...>   - Fields to display (default: name,gid)\n');
        console.log('Available fields:');
        console.log('  name, gid, archived, owner.name, color, public, due_date, start_on, notes\n');
        console.log('Task search options (use --flag value):');
        console.log('  Projects: --projects.any, --projects.not, --projects.all');
        console.log('  Sections: --sections.any, --sections.not, --sections.all');
        console.log('  Tags: --tags.any, --tags.not, --tags.all');
        console.log('  Assignee: --assignee.any, --assignee.not (use "me" for yourself)');
        console.log('  Teams: --teams.any');
        console.log('  Other: --text, --completed, --is_subtask, --is_blocked, --is_blocking');
        console.log('  Dates: --due_on.before, --due_on.after, --created_at.before, etc.');
        console.log('  Sort: --sort_by, --sort_ascending');
        console.log('  Display: --format <list|table|json>, --fields <field1,field2,...>\n');
        console.log('Task create/update options:');
        console.log('  --name <text>                  - Task name');
        console.log('  --notes <text>                 - Description (markdown auto-converted)');
        console.log('  --notes-file <path>            - Read description from markdown file');
        console.log('  --html_notes <html>            - Description in HTML');
        console.log('  --html_notes-file <path>       - Read description from HTML file');
        console.log('  --assignee <gid|me>            - Assignee (use "me" for yourself)');
        console.log('  --projects <gid1,gid2>         - Project GIDs (comma-separated)');
        console.log('  --parent <gid>                 - Parent task GID (creates/moves as subtask)');
        console.log('  --due_on <YYYY-MM-DD>          - Due date');
        console.log('  --start_on <YYYY-MM-DD>        - Start date');
        console.log('  --completed <true|false>       - Completion status');
        console.log('  --markdown <false>             - Disable markdown conversion\n');
        console.log('Examples:');
        console.log('  node index.js tasks');
        console.log('  node index.js task 1234567890 --format markdown');
        console.log('  node index.js projects --name "Native Apps"');
        console.log('  node index.js search-tasks --assignee.any me --completed false');
        console.log('  node index.js search-tasks --projects.all 123,456 --due_on.before 2026-12-31');
        console.log('  node index.js create-task --name "Fix bug" --assignee me --projects 123');
        console.log('  node index.js update-task 1234567890 --notes "Updated **description**"');
        console.log('  node index.js add-comment 1234567890 --text "Great work! 🎉"\n');
        console.log('Full API docs: https://developers.asana.com/reference/searchtasksforworkspace\n');
    }
    
    if (!command) {
        showHelp();
        process.exit(0);
    }
    
    (async () => {
        try {
            const user = await getCurrentUser(usersApiInstance);
            
            switch (command) {
                case 'tasks':
                    if (user.workspaces && user.workspaces.length > 0) {
                        const tasks = await getTasksForUser(tasksApiInstance, 'me', user.workspaces[0].gid, { completed: false });
                        displayTasks(tasks);
                    }
                    break;
                
                case 'completed':
                    if (user.workspaces && user.workspaces.length > 0) {
                        const tasks = await getTasksForUser(tasksApiInstance, 'me', user.workspaces[0].gid, { completed: true, limit: 20 });
                        displayTasks(tasks);
                    }
                    break;
                
                case 'task':
                    const taskGidToFetch = process.argv[3];
                    if (!taskGidToFetch) {
                        console.log('Please provide a task GID');
                        console.log('Usage: node index.js task <task_gid> [--format markdown|html|text]');
                        process.exit(1);
                    }
                    
                    // Validate flags
                    const taskCmdValidation = validateFlags('task', process.argv.slice(4));
                    if (!taskCmdValidation.valid) {
                        console.error(`\n❌ Invalid flag(s): --${taskCmdValidation.invalidFlags.join(', --')}\n`);
                        console.log('Valid flags for task command:');
                        console.log('  --format <markdown|html|text>  - Output format for notes\n');
                        console.log('Example:');
                        console.log('  node index.js task 1234567890 --format html\n');
                        process.exit(1);
                    }
                    
                    // Parse format option (default: markdown)
                    let noteFormat = 'markdown';
                    const formatIndex = process.argv.indexOf('--format');
                    if (formatIndex > -1 && process.argv[formatIndex + 1]) {
                        noteFormat = process.argv[formatIndex + 1];
                        if (!['markdown', 'html', 'text'].includes(noteFormat)) {
                            console.log('Invalid format. Use: markdown, html, or text');
                            process.exit(1);
                        }
                    }
                    
                    const taskDetails = await getTask(tasksApiInstance, taskGidToFetch);
                    // Fetch comment count
                    const taskStories = await getTaskStories(storiesApiInstance, taskGidToFetch, { commentsOnly: true });
                    taskDetails.commentCount = taskStories.length;
                    displayTaskDetails(taskDetails, { noteFormat });
                    break;
                
                case 'task-comments':
                    const taskGidForComments = process.argv[3];
                    if (!taskGidForComments) {
                        console.log('Please provide a task GID');
                        console.log('Usage: node index.js task-comments <task_gid>');
                        process.exit(1);
                    }
                    const stories = await getTaskStories(storiesApiInstance, taskGidForComments, { commentsOnly: true });
                    console.log(`\n💬 Comments (${stories.length}):\n`);
                    if (stories.length === 0) {
                        console.log('No comments found.');
                    } else {
                        stories.forEach((story, index) => {
                            const authorName = story.created_by?.name || 'Unknown';
                            const authorGid = story.created_by?.gid || 'unknown';
                            console.log(`${index + 1}. ${authorName} (${authorGid}) - ${story.created_at}:`);
                            console.log(`   ${story.text || '(no text)'}\n`);
                        });
                    }
                    break;
                
                case 'add-comment':
                    const taskGidForComment = process.argv[3];
                    if (!taskGidForComment) {
                        console.log('Please provide a task GID');
                        console.log('Usage: node index.js add-comment <task_gid> --text "Comment text" [--markdown false]');
                        console.log('\nOptions:');
                        console.log('  --text <text>        - Comment text (markdown auto-converted by default)');
                        console.log('  --html_text <html>   - Comment text in HTML');
                        console.log('  --markdown <false>   - Disable markdown conversion\n');
                        console.log('Examples:');
                        console.log('  node index.js add-comment 1234567890 --text "Great work!"');
                        console.log('  node index.js add-comment 1234567890 --text "**Important:** This needs review"');
                        process.exit(1);
                    }
                    
                    const commentArgs = process.argv.slice(4);
                    
                    // Validate flags
                    const commentValidation = validateFlags('add-comment', commentArgs);
                    if (!commentValidation.valid) {
                        console.error(`\n❌ Invalid flag(s): --${commentValidation.invalidFlags.join(', --')}\n`);
                        console.log('Valid flags for add-comment command:');
                        console.log('  --text <text>        - Comment text (markdown auto-converted)');
                        console.log('  --html_text <html>   - Comment text in HTML');
                        console.log('  --markdown <false>   - Disable markdown conversion\n');
                        console.log('Example:');
                        console.log('  node index.js add-comment 1234567890 --text "Great work!"\n');
                        process.exit(1);
                    }
                    
                    const commentData = {};
                    let commentConvertMarkdown = true;
                    
                    // Parse comment arguments
                    for (let i = 0; i < commentArgs.length; i++) {
                        if (commentArgs[i].startsWith('--')) {
                            const flag = commentArgs[i].substring(2);
                            const value = commentArgs[i + 1];
                            
                            if (flag === 'markdown') {
                                commentConvertMarkdown = value === 'true' || value === undefined;
                                i++;
                                continue;
                            }
                            
                            commentData[flag] = value;
                            i++;
                        }
                    }
                    
                    if (!commentData.text && !commentData.html_text) {
                        console.log('Please provide comment text using --text or --html_text');
                        process.exit(1);
                    }
                    
                    console.log(`Adding comment to task ${taskGidForComment}...`);
                    const newComment = await addTaskComment(storiesApiInstance, taskGidForComment, commentData, { convertMarkdown: commentConvertMarkdown });
                    console.log('✅ Comment added successfully!');
                    console.log(`Text: ${newComment.text || '(HTML formatted)'}`);
                    break;
                
                case 'user':
                    displayUserInfo(user);
                    break;
                
                case 'projects':
                    const args = process.argv.slice(3);
                    
                    // Validate flags
                    const projectValidation = validateFlags('projects', args);
                    if (!projectValidation.valid) {
                        console.error(`\n❌ Invalid flag(s): --${projectValidation.invalidFlags.join(', --')}\n`);
                        console.log('Valid flags for projects command:');
                        console.log('  --name <text>                  - Search by name');
                        console.log('  --archived <true|false>        - Filter by archived status');
                        console.log('  --format <list|table|json|inline> - Output format');
                        console.log('  --fields <field1,field2,...>   - Fields to display\n');
                        console.log('Example:');
                        console.log('  node index.js projects --name "Native Apps" --format table\n');
                        process.exit(1);
                    }
                    
                    const searchOptions = {};
                    const displayOptions = {};
                    
                    // Parse arguments
                    for (let i = 0; i < args.length; i++) {
                        if (args[i].startsWith('--')) {
                            const flag = args[i].substring(2);
                            const value = args[i + 1];
                            
                            if (flag === 'name') {
                                searchOptions.name = value;
                                i++;
                            } else if (flag === 'archived') {
                                searchOptions.archived = value === 'true';
                                i++;
                            } else if (flag === 'format') {
                                displayOptions.format = value;
                                i++;
                            } else if (flag === 'fields') {
                                const fields = value.split(',');
                                displayOptions.fields = fields;
                                searchOptions.fields = fields; // Pass to search to control API fetch
                                i++;
                            }
                        }
                    }
                    
                    if (user.workspaces && user.workspaces.length > 0) {
                        const projects = await searchProjects(projectsApiInstance, user.workspaces[0].gid, searchOptions);
                        displayProjects(projects, displayOptions);
                    }
                    break;
                
                case 'search-tasks':
                    const taskArgs = process.argv.slice(3);
                    
                    // Validate flags
                    const taskValidation = validateFlags('search-tasks', taskArgs);
                    if (!taskValidation.valid) {
                        console.error(`\n❌ Invalid flag(s): --${taskValidation.invalidFlags.join(', --')}\n`);
                        console.log('Valid search-tasks flags include:');
                        console.log('  Projects: --projects.any, --projects.not, --projects.all');
                        console.log('  Sections: --sections.any, --sections.not, --sections.all');
                        console.log('  Tags: --tags.any, --tags.not, --tags.all');
                        console.log('  Assignee: --assignee.any, --assignee.not');
                        console.log('  Boolean: --completed, --is_subtask, --is_blocked, --is_blocking, --has_attachment');
                        console.log('  Dates: --due_on, --due_on.before, --due_on.after, --created_at.before, etc.');
                        console.log('  Other: --text, --sort_by, --sort_ascending');
                        console.log('  Display: --format, --fields\n');
                        console.log('Examples:');
                        console.log('  node index.js search-tasks --assignee.any me --completed false');
                        console.log('  node index.js search-tasks --projects.all 123,456 --due_on.before 2026-12-31\n');
                        console.log('Full docs: https://developers.asana.com/reference/searchtasksforworkspace\n');
                        process.exit(1);
                    }
                    
                    const taskSearchOptions = {
                        workspace: user.workspaces && user.workspaces.length > 0 ? user.workspaces[0].gid : null
                    };
                    const taskDisplayOptions = {};
                    
                    if (!taskSearchOptions.workspace) {
                        console.log('No workspace found for user');
                        process.exit(1);
                    }
                    
                    // Parse arguments - support all API parameters
                    for (let i = 0; i < taskArgs.length; i++) {
                        if (taskArgs[i].startsWith('--')) {
                            const flag = taskArgs[i].substring(2);
                            const value = taskArgs[i + 1];
                            
                            // Display options
                            if (flag === 'format') {
                                taskDisplayOptions.format = value;
                                i++;
                            } else if (flag === 'fields') {
                                const fields = value.split(',');
                                taskDisplayOptions.fields = fields;
                                taskSearchOptions.fields = fields;
                                i++;
                            }
                            // Boolean parameters
                            else if (['completed', 'is_subtask', 'is_blocked', 'is_blocking', 'has_attachment', 'sort_ascending'].includes(flag)) {
                                taskSearchOptions[flag] = value === 'true';
                                i++;
                            }
                            // All other parameters - pass directly to API
                            else {
                                taskSearchOptions[flag] = value;
                                i++;
                            }
                        }
                    }
                    
                    const foundTasks = await searchTasks(tasksApiInstance, taskSearchOptions);
                    displaySearchedTasks(foundTasks, taskDisplayOptions);
                    break;
                
                case 'create-task':
                    const createArgs = process.argv.slice(3);
                    
                    // Validate flags
                    const createValidation = validateFlags('create-task', createArgs);
                    if (!createValidation.valid) {
                        console.error(`\n❌ Invalid flag(s): --${createValidation.invalidFlags.join(', --')}\n`);
                        console.log('Valid flags for create-task command:');
                        console.log('  --name <text>           - Task name (required)');
                        console.log('  --notes <text>          - Description (markdown auto-converted)');
                        console.log('  --notes-file <path>     - Read description from markdown file');
                        console.log('  --html_notes <html>     - Description in HTML');
                        console.log('  --html_notes-file <path> - Read description from HTML file');
                        console.log('  --assignee <gid|me>     - Assignee');
                        console.log('  --projects <gid1,gid2>  - Project GIDs (comma-separated)');
                        console.log('  --workspace <gid>       - Workspace GID (for personal tasks)');
                        console.log('  --parent <gid>          - Parent task GID (creates as subtask)');
                        console.log('  --due_on <YYYY-MM-DD>   - Due date');
                        console.log('  --due_at <datetime>     - Due datetime (ISO 8601)');
                        console.log('  --start_on <YYYY-MM-DD> - Start date');
                        console.log('  --completed <true|false> - Completion status');
                        console.log('  --markdown <false>      - Disable markdown conversion\n');
                        console.log('Examples:');
                        console.log('  node index.js create-task --name "Fix bug" --assignee me --projects 123');
                        console.log('  node index.js create-task --name "Personal task" --assignee me --workspace 137249556945\n');
                        process.exit(1);
                    }
                    
                    const taskData = {};
                    let createConvertMarkdown = true; // Default to true - convert markdown automatically
                    
                    // Parse task creation arguments
                    for (let i = 0; i < createArgs.length; i++) {
                        if (createArgs[i].startsWith('--')) {
                            const flag = createArgs[i].substring(2);
                            const value = createArgs[i + 1];
                            
                            // Special handling for markdown conversion flag
                            if (flag === 'markdown') {
                                createConvertMarkdown = value === 'true' || value === undefined;
                                i++;
                                continue;
                            }
                            
                            // Convert boolean strings
                            if (value === 'true') {
                                taskData[flag] = true;
                            } else if (value === 'false') {
                                taskData[flag] = false;
                            } else if (value === 'null') {
                                taskData[flag] = null;
                            } else {
                                taskData[flag] = value;
                            }
                            i++;
                        }
                    }
                    
                    // Handle file input for notes
                    if (taskData['notes-file']) {
                        const filePath = path.resolve(taskData['notes-file']);
                        try {
                            taskData.notes = fs.readFileSync(filePath, 'utf8');
                            console.log(`📄 Read notes from: ${filePath}`);
                            delete taskData['notes-file'];
                        } catch (error) {
                            console.error(`❌ Error reading notes file: ${error.message}`);
                            process.exit(1);
                        }
                    }
                    
                    if (taskData['html_notes-file']) {
                        const filePath = path.resolve(taskData['html_notes-file']);
                        try {
                            taskData.html_notes = fs.readFileSync(filePath, 'utf8');
                            console.log(`📄 Read HTML notes from: ${filePath}`);
                            delete taskData['html_notes-file'];
                        } catch (error) {
                            console.error(`❌ Error reading HTML notes file: ${error.message}`);
                            process.exit(1);
                        }
                    }
                    
                    // Validate required fields
                    if (!taskData.name) {
                        console.log('Please provide at least a task name');
                        console.log('Usage: node index.js create-task --name "Task Name" [options]');
                        console.log('\nRequired:');
                        console.log('  --name          Task name');
                        console.log('\nOptional:');
                        console.log('  --notes         Task description (markdown supported by default)');
                        console.log('  --notes-file    Path to markdown file for task description');
                        console.log('  --html_notes    Task description in HTML');
                        console.log('  --html_notes-file Path to HTML file for task description');
                        console.log('  --projects      Project GID (comma-separated for multiple)');
                        console.log('  --workspace     Workspace GID (for personal tasks, visible only to you)');
                        console.log('  --assignee      User GID (use "me" for yourself)');
                        console.log('  --due_on        Due date (YYYY-MM-DD)');
                        console.log('  --due_at        Due datetime (ISO 8601)');
                        console.log('  --start_on      Start date (YYYY-MM-DD)');
                        console.log('  --completed     Completion status (true/false)');
                        console.log('  --markdown      Enable/disable markdown conversion (default: true)');
                        console.log('\nNote: Use --workspace for personal tasks (not in any project), or --projects for shared tasks');
                        process.exit(1);
                    }
                    
                    // Handle markdown conversion for notes
                    if (taskData.notes && createConvertMarkdown && /[*_#\[\]`]/.test(taskData.notes)) {
                        const { prepareTaskUpdates } = require('./lib/markdown');
                        const processed = prepareTaskUpdates({ notes: taskData.notes });
                        if (processed.html_notes) {
                            taskData.html_notes = processed.html_notes;
                            delete taskData.notes;
                        }
                    }
                    
                    // Handle project list
                    if (taskData.projects && typeof taskData.projects === 'string') {
                        taskData.projects = taskData.projects.split(',').map(p => p.trim());
                    }
                    
                    console.log('Creating task:', taskData);
                    const newTask = await createTask(tasksApiInstance, taskData);
                    console.log(`✅ Task created successfully!`);
                    console.log(`Name: ${newTask.name}`);
                    console.log(`GID: ${newTask.gid}`);
                    console.log(`URL: https://app.asana.com/0/0/${newTask.gid}`);
                    break;
                
                case 'update-task':
                    const taskGid = process.argv[3];
                    if (!taskGid) {
                        console.log('Please provide a task GID to update');
                        console.log('Usage: node index.js update-task <task_gid> [options]');
                        console.log('\nOptions:');
                        console.log('  --name <text>           - Update task name');
                        console.log('  --notes <text>          - Update description (markdown auto-converted)');
                        console.log('  --html_notes <html>     - Update description with HTML');
                        console.log('  --assignee <gid|me>     - Change assignee');
                        console.log('  --projects <gid1,gid2>  - Set project(s)');
                        console.log('  --parent <gid>          - Move to parent task (make subtask)');
                        console.log('  --due_on <YYYY-MM-DD>   - Set due date');
                        console.log('  --start_on <YYYY-MM-DD> - Set start date');
                        console.log('  --completed <true|false> - Mark complete/incomplete');
                        console.log('  --markdown <false>      - Disable markdown conversion');
                        console.log('\nExample:');
                        console.log('  node index.js update-task 1234567890 --notes "Updated **description**"');
                        process.exit(1);
                    }
                    
                    const updateArgs = process.argv.slice(4);
                    
                    // Validate flags
                    const updateValidation = validateFlags('update-task', updateArgs);
                    if (!updateValidation.valid) {
                        console.error(`\n❌ Invalid flag(s): --${updateValidation.invalidFlags.join(', --')}\n`);
                        console.log('Valid flags for update-task command:');
                        console.log('  --name <text>           - Update task name');
                        console.log('  --notes <text>          - Update description (markdown auto-converted)');
                        console.log('  --notes-file <path>     - Read description from markdown file');
                        console.log('  --html_notes <html>     - Update description with HTML');
                        console.log('  --html_notes-file <path> - Read description from HTML file');
                        console.log('  --assignee <gid|me>     - Change assignee');
                        console.log('  --projects <gid1,gid2>  - Set project(s)');
                        console.log('  --parent <gid>          - Move to parent task (make subtask)');
                        console.log('  --due_on <YYYY-MM-DD>   - Set due date');
                        console.log('  --start_on <YYYY-MM-DD> - Set start date');
                        console.log('  --completed <true|false> - Mark complete/incomplete');
                        console.log('  --markdown <false>      - Disable markdown conversion\n');
                        console.log('Example:');
                        console.log('  node index.js update-task 1234567890 --notes "Updated **description**"\n');
                        process.exit(1);
                    }
                    
                    const updates = {};
                    let convertMarkdown = true; // Default to true - convert markdown automatically
                    
                    // Parse update arguments
                    for (let i = 0; i < updateArgs.length; i++) {
                        if (updateArgs[i].startsWith('--')) {
                            const flag = updateArgs[i].substring(2);
                            const value = updateArgs[i + 1];
                            
                            // Special handling for markdown conversion flag
                            if (flag === 'markdown') {
                                convertMarkdown = value === 'true' || value === undefined;
                                i++;
                                continue;
                            }
                            
                            // Convert boolean strings
                            if (value === 'true') {
                                updates[flag] = true;
                            } else if (value === 'false') {
                                updates[flag] = false;
                            } else if (value === 'null') {
                                updates[flag] = null;
                            } else {
                                updates[flag] = value;
                            }
                            i++;
                        }
                    }
                    
                    // Handle file input for notes
                    if (updates['notes-file']) {
                        const filePath = path.resolve(updates['notes-file']);
                        try {
                            updates.notes = fs.readFileSync(filePath, 'utf8');
                            console.log(`📄 Read notes from: ${filePath}`);
                            delete updates['notes-file'];
                        } catch (error) {
                            console.error(`❌ Error reading notes file: ${error.message}`);
                            process.exit(1);
                        }
                    }
                    
                    if (updates['html_notes-file']) {
                        const filePath = path.resolve(updates['html_notes-file']);
                        try {
                            updates.html_notes = fs.readFileSync(filePath, 'utf8');
                            console.log(`📄 Read HTML notes from: ${filePath}`);
                            delete updates['html_notes-file'];
                        } catch (error) {
                            console.error(`❌ Error reading HTML notes file: ${error.message}`);
                            process.exit(1);
                        }
                    }
                    
                    if (Object.keys(updates).length === 0) {
                        console.log('Please provide fields to update (e.g., --name "New Name" --due_on 2024-12-31)');
                        process.exit(1);
                    }
                    
                    // Warn if markdown syntax detected but markdown conversion disabled
                    if (updates.notes && !convertMarkdown && /[*_#\[\]`]/.test(updates.notes)) {
                        console.log('\n⚠️  WARNING: Detected markdown-like syntax but --markdown false was specified!');
                        console.log('   Your text will be stored as plain text with ** and other markdown symbols visible.');
                        console.log('   Remove --markdown false to enable automatic markdown conversion.\n');
                    }
                    
                    console.log(`Updating task ${taskGid}:`, updates);
                    const updatedTask = await updateTask(tasksApiInstance, taskGid, updates, { convertMarkdown });
                    console.log('✅ Task updated successfully!');
                    console.log(`Name: ${updatedTask.name}`);
                    if (updatedTask.start_on) console.log(`Start: ${updatedTask.start_on}`);
                    if (updatedTask.due_on) console.log(`Due: ${updatedTask.due_on}`);
                    break;
                
                case 'sections':
                    const projectGidForSections = process.argv[3];
                    if (!projectGidForSections) {
                        console.log('Usage: node index.js sections <project_gid> [--format json|list|table] [--fields name,gid]');
                        console.log('\nList all sections in a project');
                        console.log('\nOptions:');
                        console.log('  --format <format>   - Output format: list (default), table, json');
                        console.log('  --fields <fields>   - Comma-separated fields to display (default: name,gid)\n');
                        console.log('Example:');
                        console.log('  node index.js sections 1234567890');
                        process.exit(1);
                    }
                    
                    const sectionsArgs = process.argv.slice(4);
                    const sectionsValidation = validateFlags('sections', sectionsArgs);
                    if (!sectionsValidation.valid) {
                        console.error(`\n❌ Invalid flag(s): --${sectionsValidation.invalidFlags.join(', --')}\n`);
                        console.log('Valid flags for sections command:');
                        console.log('  --format <format>   - Output format: list, table, json');
                        console.log('  --fields <fields>   - Comma-separated fields to display\n');
                        process.exit(1);
                    }
                    
                    const sectionsOptions = parseArgs(sectionsArgs);
                    const sections = await getSections(sectionsApiInstance, projectGidForSections);
                    
                    const sectionsDisplayOpts = {
                        format: sectionsOptions.format || 'list',
                        fields: sectionsOptions.fields ? sectionsOptions.fields.split(',') : ['name', 'gid']
                    };
                    
                    displaySections(sections, sectionsDisplayOpts);
                    break;
                
                case 'add-to-project':
                    const taskGidForAdd = process.argv[3];
                    if (!taskGidForAdd) {
                        console.log('Usage: node index.js add-to-project <task_gid> --project <project_gid> [--section <section_gid>]');
                        console.log('\nAdd task to a project, or move task to a section if already in project');
                        console.log('\nOptions:');
                        console.log('  --project <gid>   - Project GID (required)');
                        console.log('  --section <gid>   - Section GID within the project (optional)\n');
                        console.log('Examples:');
                        console.log('  node index.js add-to-project 1234567890 --project 9876543210');
                        console.log('  node index.js add-to-project 1234567890 --project 9876543210 --section 1111111111');
                        console.log('\nTip: Use "sections <project_gid>" to list sections in a project');
                        process.exit(1);
                    }
                    
                    const addArgs = process.argv.slice(4);
                    const addValidation = validateFlags('add-to-project', addArgs);
                    if (!addValidation.valid) {
                        console.error(`\n❌ Invalid flag(s): --${addValidation.invalidFlags.join(', --')}\n`);
                        console.log('Valid flags for add-to-project command:');
                        console.log('  --project <gid>   - Project GID (required)');
                        console.log('  --section <gid>   - Section GID (optional)\n');
                        process.exit(1);
                    }
                    
                    const addOptions = parseArgs(addArgs);
                    if (!addOptions.project) {
                        console.error('❌ --project flag is required\n');
                        console.log('Usage: node index.js add-to-project <task_gid> --project <project_gid> [--section <section_gid>]');
                        process.exit(1);
                    }
                    
                    await addTaskToProject(tasksApiInstance, taskGidForAdd, addOptions.project, addOptions.section);
                    console.log('✅ Task updated successfully!');
                    if (addOptions.section) {
                        console.log(`Task ${taskGidForAdd} moved to section ${addOptions.section} in project ${addOptions.project}`);
                    } else {
                        console.log(`Task ${taskGidForAdd} added to project ${addOptions.project}`);
                    }
                    break;
                
                case 'remove-from-project':
                    const taskGidForRemove = process.argv[3];
                    if (!taskGidForRemove) {
                        console.log('Usage: node index.js remove-from-project <task_gid> --project <project_gid>');
                        console.log('\nRemove task from a project');
                        console.log('\nOptions:');
                        console.log('  --project <gid>   - Project GID (required)\n');
                        console.log('Example:');
                        console.log('  node index.js remove-from-project 1234567890 --project 9876543210');
                        process.exit(1);
                    }
                    
                    const removeArgs = process.argv.slice(4);
                    const removeValidation = validateFlags('remove-from-project', removeArgs);
                    if (!removeValidation.valid) {
                        console.error(`\n❌ Invalid flag(s): --${removeValidation.invalidFlags.join(', --')}\n`);
                        console.log('Valid flags for remove-from-project command:');
                        console.log('  --project <gid>   - Project GID (required)\n');
                        process.exit(1);
                    }
                    
                    const removeOptions = parseArgs(removeArgs);
                    if (!removeOptions.project) {
                        console.error('❌ --project flag is required\n');
                        console.log('Usage: node index.js remove-from-project <task_gid> --project <project_gid>');
                        process.exit(1);
                    }
                    
                    await removeTaskFromProject(tasksApiInstance, taskGidForRemove, removeOptions.project);
                    console.log('✅ Task removed from project successfully!');
                    console.log(`Task ${taskGidForRemove} removed from project ${removeOptions.project}`);
                    break;
                
                case 'clear-cache':
                    clearCache();
                    break;
                
                default:
                    console.error(`\n❌ Unknown command: ${command}\n`);
                    showHelp();
                    process.exit(1);
            }
        } catch (error) {
            console.error('Error:', error.message);
            
            // Check if it's an SSL/TLS certificate error
            const certErrors = [
                'unable to verify',
                'self signed certificate',
                'certificate',
                'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
                'SELF_SIGNED_CERT_IN_CHAIN',
                'CERT_',
                'ssl',
                'tls'
            ];
            
            const errorMessage = (error.message || '').toLowerCase();
            const errorCode = (error.code || '').toUpperCase();
            const isCertError = certErrors.some(pattern => 
                errorMessage.includes(pattern.toLowerCase()) || 
                errorCode.includes(pattern.toUpperCase())
            );
            
            if (isCertError) {
                console.error('\n💡 This appears to be an SSL certificate error.');
                console.error('   Try running with NODE_TLS_REJECT_UNAUTHORIZED=0:\n');
                console.error(`   NODE_TLS_REJECT_UNAUTHORIZED=0 node index.js ${process.argv.slice(2).join(' ')}\n`);
                console.error('   ⚠️  Note: Only use this in development environments.\n');
            }
            
            process.exit(1);
        }
    })();
}