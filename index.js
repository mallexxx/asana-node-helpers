/**
 * Asana Node Helpers - Main Entry Point
 * 
 * This is the main entry point for the application.
 * Import and export all modules for easy access.
 */

// Import feature modules
const { initializeClient } = require('./lib/client');
const { getCurrentUser, getUser } = require('./lib/users');
const { getTasksForUser, getTask, getTaskStories, createTask, updateTask, searchTasks, displaySearchedTasks } = require('./lib/tasks');
const { displayTasks, displayTaskDetails, displayUserInfo } = require('./lib/display');
const { searchProjects, displayProjects, clearCache } = require('./lib/projects');

// Initialize Asana client (this validates API key)
const {
    client,
    tasksApiInstance,
    usersApiInstance,
    projectsApiInstance,
    workspacesApiInstance,
    storiesApiInstance
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
    
    if (!command) {
        console.log('\n🚀 Asana Node Helpers\n');
        console.log('Usage: node index.js <command>\n');
        console.log('Commands:');
        console.log('  tasks                          - Fetch your incomplete tasks');
        console.log('  completed                      - Fetch your completed tasks');
        console.log('  task <gid>                     - Get details of a specific task');
        console.log('  task-comments <gid>            - Get comments/discussion for a task');
        console.log('  user                           - Show current user info');
        console.log('  projects [options]             - Search projects');
        console.log('  search-tasks [options]         - Search tasks with filters');
        console.log('  update-task <gid> [options]    - Update a task');
        console.log('  clear-cache                    - Clear projects cache\n');
        console.log('Project search options (use --flag value):');
        console.log('  --name <text>                  - Search by name');
        console.log('  --archived <true|false>        - Filter by archived status');
        console.log('  --format <list|table|json|inline> - Output format (default: list)');
        console.log('  --fields <field1,field2,...>   - Fields to display (default: name,gid)\n');
        console.log('Available fields:');
        console.log('  name, gid, archived, owner.name, color, public, due_date, start_on, notes\n');
        console.log('Examples:');
        console.log('  node index.js projects --name "My Project"');
        console.log('  node index.js projects --archived false --format table');
        console.log('  node index.js projects --name "API" --fields name,gid,owner.name,due_date');
        console.log('  node index.js projects --format json\n');
        console.log('Task search options (use --flag value):');
        console.log('  Projects: --projects.any, --projects.not, --projects.all');
        console.log('  Sections: --sections.any, --sections.not, --sections.all');
        console.log('  Tags: --tags.any, --tags.not, --tags.all');
        console.log('  Assignee: --assignee.any, --assignee.not');
        console.log('  Teams: --teams.any');
        console.log('  Other: --text, --completed, --is_subtask, --is_blocked, --is_blocking');
        console.log('  Dates: --due_on.before, --due_on.after, --created_at.before, etc.');
        console.log('  Sort: --sort_by, --sort_ascending');
        console.log('  Display: --format <list|table|json>, --fields <field1,field2,...>\n');
        console.log('Full docs: https://developers.asana.com/reference/searchtasksforworkspace\n');
        console.log('Examples:');
        console.log('  node index.js search-tasks --projects.all 1234567890,9876543210 --assignee.any me');
        console.log('  node index.js search-tasks --projects.any 1234567890,9876543210 --completed false');
        console.log('  node index.js search-tasks --text "bug" --is_blocked true --format table\n');
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
                        console.log('Usage: node index.js task <task_gid>');
                        process.exit(1);
                    }
                    const taskDetails = await getTask(tasksApiInstance, taskGidToFetch);
                    // Fetch comment count
                    const taskStories = await getTaskStories(storiesApiInstance, taskGidToFetch, { commentsOnly: true });
                    taskDetails.commentCount = taskStories.length;
                    displayTaskDetails(taskDetails);
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
                
                case 'user':
                    displayUserInfo(user);
                    break;
                
                case 'projects':
                    const args = process.argv.slice(3);
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
                
                case 'update-task':
                    const taskGid = process.argv[3];
                    if (!taskGid) {
                        console.log('Please provide a task GID to update');
                        process.exit(1);
                    }
                    
                    const updateArgs = process.argv.slice(4);
                    const updates = {};
                    
                    // Parse update arguments
                    for (let i = 0; i < updateArgs.length; i++) {
                        if (updateArgs[i].startsWith('--')) {
                            const flag = updateArgs[i].substring(2);
                            const value = updateArgs[i + 1];
                            
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
                    
                    if (Object.keys(updates).length === 0) {
                        console.log('Please provide fields to update (e.g., --name "New Name" --due_on 2024-12-31)');
                        process.exit(1);
                    }
                    
                    console.log(`Updating task ${taskGid}:`, updates);
                    const updatedTask = await updateTask(tasksApiInstance, taskGid, updates);
                    console.log('Task updated successfully!');
                    console.log(`Name: ${updatedTask.name}`);
                    if (updatedTask.start_on) console.log(`Start: ${updatedTask.start_on}`);
                    if (updatedTask.due_on) console.log(`Due: ${updatedTask.due_on}`);
                    break;
                
                case 'clear-cache':
                    clearCache();
                    break;
                
                default:
                    console.error(`Unknown command: ${command}`);
                    process.exit(1);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}