#!/usr/bin/env node
/**
 * Asana MCP Server
 * 
 * Exposes Asana task management capabilities as MCP tools for AI assistants.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Import Node.js modules
const fs = require('fs');
const path = require('path');

// Import our Asana helpers
const { initializeClient } = require('./lib/client');
const { getCurrentUser } = require('./lib/users');
const { 
    getTasksForUser, 
    getTask, 
    getTaskStories, 
    addTaskComment,
    createTask, 
    updateTask, 
    searchTasks 
} = require('./lib/tasks');
const { searchProjects } = require('./lib/projects');

// Initialize Asana client
let client, tasksApiInstance, usersApiInstance, projectsApiInstance, storiesApiInstance;
let currentUser = null;

async function initializeAsana() {
    if (!process.env.ASANA_API_KEY) {
        throw new Error('ASANA_API_KEY environment variable is required');
    }
    
    const apiInstances = initializeClient();
    client = apiInstances.client;
    tasksApiInstance = apiInstances.tasksApiInstance;
    usersApiInstance = apiInstances.usersApiInstance;
    projectsApiInstance = apiInstances.projectsApiInstance;
    storiesApiInstance = apiInstances.storiesApiInstance;
    
    // Get current user for workspace context
    currentUser = await getCurrentUser(usersApiInstance);
    
    return {
        user: currentUser,
        workspace: currentUser.workspaces?.[0]?.gid
    };
}

// Create MCP server
const server = new Server(
    {
        name: 'asana-helpers',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'search_tasks',
                description: 'Search for tasks with advanced filters. Supports filtering by assignee, projects, tags, dates, completion status, and more. Use assignee.any="me" for your tasks.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        assignee_any: { type: 'string', description: 'User GID or "me" for your tasks' },
                        projects_any: { type: 'string', description: 'Comma-separated project GIDs (OR logic)' },
                        projects_all: { type: 'string', description: 'Comma-separated project GIDs (AND logic)' },
                        completed: { type: 'boolean', description: 'Filter by completion status' },
                        due_on_before: { type: 'string', description: 'Tasks due before date (YYYY-MM-DD)' },
                        due_on_after: { type: 'string', description: 'Tasks due after date (YYYY-MM-DD)' },
                        text: { type: 'string', description: 'Search text in task name/description' },
                        tags_any: { type: 'string', description: 'Comma-separated tag GIDs' },
                        sort_by: { type: 'string', description: 'Sort field (e.g., due_date, created_at)' },
                        limit: { type: 'number', description: 'Max results (default 100)' }
                    }
                }
            },
            {
                name: 'get_task',
                description: 'Get detailed information about a specific task including notes, subtasks, projects, comments count, and all metadata.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_gid: { type: 'string', description: 'Task GID' }
                    },
                    required: ['task_gid']
                }
            },
            {
                name: 'create_task',
                description: 'Create a new task. Supports markdown formatting in notes. Use workspace parameter for personal tasks or projects parameter for shared tasks.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Task name' },
                        notes: { type: 'string', description: 'Task description (markdown supported)' },
                        notes_file: { type: 'string', description: 'Path to markdown file for task description' },
                        html_notes_file: { type: 'string', description: 'Path to HTML file for task description' },
                        assignee: { type: 'string', description: 'User GID or "me"' },
                        projects: { type: 'string', description: 'Comma-separated project GIDs' },
                        workspace: { type: 'string', description: 'Workspace GID for personal tasks' },
                        parent: { type: 'string', description: 'Parent task GID (creates as subtask)' },
                        due_on: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
                        start_on: { type: 'string', description: 'Start date (YYYY-MM-DD)' }
                    },
                    required: ['name']
                }
            },
            {
                name: 'update_task',
                description: 'Update a task. Supports updating any field including notes (with markdown), assignee, dates, completion status.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_gid: { type: 'string', description: 'Task GID' },
                        name: { type: 'string', description: 'New task name' },
                        notes: { type: 'string', description: 'New description (markdown supported)' },
                        notes_file: { type: 'string', description: 'Path to markdown file for task description' },
                        html_notes_file: { type: 'string', description: 'Path to HTML file for task description' },
                        assignee: { type: 'string', description: 'User GID or "me"' },
                        parent: { type: 'string', description: 'Parent task GID (move to subtask)' },
                        due_on: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
                        start_on: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
                        completed: { type: 'boolean', description: 'Completion status' }
                    },
                    required: ['task_gid']
                }
            },
            {
                name: 'add_comment',
                description: 'Add a comment to a task. Supports markdown formatting.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_gid: { type: 'string', description: 'Task GID' },
                        text: { type: 'string', description: 'Comment text (markdown supported)' }
                    },
                    required: ['task_gid', 'text']
                }
            },
            {
                name: 'get_task_comments',
                description: 'Get all comments for a task.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_gid: { type: 'string', description: 'Task GID' }
                    },
                    required: ['task_gid']
                }
            },
            {
                name: 'search_projects',
                description: 'Search for projects by name or other criteria.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Project name to search for' },
                        archived: { type: 'boolean', description: 'Filter by archived status' }
                    }
                }
            },
            {
                name: 'get_my_tasks',
                description: 'Get your incomplete tasks (shortcut for common use case).',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ]
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;
        
        // Ensure Asana is initialized
        if (!currentUser) {
            await initializeAsana();
        }
        
        switch (name) {
            case 'search_tasks': {
                const searchOptions = {
                    workspace: currentUser.workspaces[0].gid,
                    limit: args.limit || 100
                };
                
                // Map MCP arguments to Asana API parameters
                if (args.assignee_any) searchOptions['assignee.any'] = args.assignee_any;
                if (args.projects_any) searchOptions['projects.any'] = args.projects_any;
                if (args.projects_all) searchOptions['projects.all'] = args.projects_all;
                if (args.completed !== undefined) searchOptions.completed = args.completed;
                if (args.due_on_before) searchOptions['due_on.before'] = args.due_on_before;
                if (args.due_on_after) searchOptions['due_on.after'] = args.due_on_after;
                if (args.text) searchOptions.text = args.text;
                if (args.tags_any) searchOptions['tags.any'] = args.tags_any;
                if (args.sort_by) searchOptions.sort_by = args.sort_by;
                
                const tasks = await searchTasks(tasksApiInstance, searchOptions);
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(tasks, null, 2)
                        }
                    ]
                };
            }
            
            case 'get_task': {
                const task = await getTask(tasksApiInstance, args.task_gid);
                const comments = await getTaskStories(storiesApiInstance, args.task_gid, { commentsOnly: true });
                task.commentCount = comments.length;
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(task, null, 2)
                        }
                    ]
                };
            }
            
            case 'create_task': {
                const taskData = {
                    name: args.name,
                    workspace: args.workspace || currentUser.workspaces[0].gid
                };
                
                // Handle file input for notes
                if (args.notes_file) {
                    try {
                        taskData.notes = fs.readFileSync(path.resolve(args.notes_file), 'utf8');
                    } catch (error) {
                        throw new Error(`Failed to read notes file: ${error.message}`);
                    }
                } else if (args.notes) {
                    taskData.notes = args.notes;
                }
                
                if (args.html_notes_file) {
                    try {
                        taskData.html_notes = fs.readFileSync(path.resolve(args.html_notes_file), 'utf8');
                    } catch (error) {
                        throw new Error(`Failed to read HTML notes file: ${error.message}`);
                    }
                }
                
                if (args.assignee) taskData.assignee = args.assignee;
                if (args.projects) taskData.projects = args.projects.split(',').map(p => p.trim());
                if (args.parent) taskData.parent = args.parent;
                if (args.due_on) taskData.due_on = args.due_on;
                if (args.start_on) taskData.start_on = args.start_on;
                
                const task = await createTask(tasksApiInstance, taskData);
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Task created successfully!\nName: ${task.name}\nGID: ${task.gid}\nURL: https://app.asana.com/0/0/${task.gid}`
                        }
                    ]
                };
            }
            
            case 'update_task': {
                const updates = {};
                
                // Handle file input for notes
                if (args.notes_file) {
                    try {
                        updates.notes = fs.readFileSync(path.resolve(args.notes_file), 'utf8');
                    } catch (error) {
                        throw new Error(`Failed to read notes file: ${error.message}`);
                    }
                } else if (args.notes) {
                    updates.notes = args.notes;
                }
                
                if (args.html_notes_file) {
                    try {
                        updates.html_notes = fs.readFileSync(path.resolve(args.html_notes_file), 'utf8');
                    } catch (error) {
                        throw new Error(`Failed to read HTML notes file: ${error.message}`);
                    }
                }
                
                if (args.name) updates.name = args.name;
                if (args.assignee) updates.assignee = args.assignee;
                if (args.parent) updates.parent = args.parent;
                if (args.due_on) updates.due_on = args.due_on;
                if (args.start_on) updates.start_on = args.start_on;
                if (args.completed !== undefined) updates.completed = args.completed;
                
                const task = await updateTask(tasksApiInstance, args.task_gid, updates, { convertMarkdown: true });
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Task updated successfully!\nName: ${task.name}\nGID: ${task.gid}`
                        }
                    ]
                };
            }
            
            case 'add_comment': {
                const comment = await addTaskComment(
                    storiesApiInstance, 
                    args.task_gid, 
                    { text: args.text },
                    { convertMarkdown: true }
                );
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Comment added successfully!`
                        }
                    ]
                };
            }
            
            case 'get_task_comments': {
                const comments = await getTaskStories(storiesApiInstance, args.task_gid, { commentsOnly: true });
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(comments, null, 2)
                        }
                    ]
                };
            }
            
            case 'search_projects': {
                const searchOptions = {};
                if (args.name) searchOptions.name = args.name;
                if (args.archived !== undefined) searchOptions.archived = args.archived;
                
                const projects = await searchProjects(
                    projectsApiInstance,
                    currentUser.workspaces[0].gid,
                    searchOptions
                );
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(projects, null, 2)
                        }
                    ]
                };
            }
            
            case 'get_my_tasks': {
                const tasks = await getTasksForUser(
                    tasksApiInstance,
                    'me',
                    currentUser.workspaces[0].gid,
                    { completed: false }
                );
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(tasks, null, 2)
                        }
                    ]
                };
            }
            
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error.message}`
                }
            ],
            isError: true
        };
    }
});

// Start the server
async function main() {
    try {
        console.error('Starting Asana MCP Server...');
        
        const transport = new StdioServerTransport();
        await server.connect(transport);
        
        console.error('Asana MCP Server running on stdio');
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

main();
