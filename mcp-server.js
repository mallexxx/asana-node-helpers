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

// Logging setup
const LOG_FILE = path.join(__dirname, 'mcp-server.log');
const LOG_ENABLED = process.env.MCP_LOG !== 'false'; // Enabled by default

function log(level, message, data = null) {
    if (!LOG_ENABLED) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...(data && { data })
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
        // Use appendFileSync for immediate writes (important for stdio-based servers)
        fs.appendFileSync(LOG_FILE, logLine, { encoding: 'utf8', mode: 0o666 });
    } catch (error) {
        // If logging fails, write to stderr but don't crash
        // stderr goes to the MCP client's logs, not stdout which is used for protocol
        console.error(`[MCP LOG ERROR] Failed to write to ${LOG_FILE}:`, error.message);
        console.error(`[MCP LOG ERROR] Attempted to log: ${level} - ${message}`);
    }
}

// Test log on module load to verify logging works
if (LOG_ENABLED) {
    try {
        log('info', 'MCP server module loaded', {
            timestamp: new Date().toISOString(),
            logFile: LOG_FILE,
            cwd: process.cwd(),
            dirname: __dirname
        });
    } catch (error) {
        console.error('[MCP LOG ERROR] Failed to write initial log entry:', error);
    }
}

// Import our Asana helpers
const { initializeClient } = require('./lib/client');
const { getCurrentUser } = require('./lib/users');
const {
    getTasksForUser,
    getTask,
    getTaskStories,
    addTaskComment,
    extractAsanaTaskId,
    createTask, 
    updateTask,
    addTaskToProject,
    removeTaskFromProject,
    searchTasks,
    getTasksForProject
} = require('./lib/tasks');
const { searchProjects, getSections } = require('./lib/projects');
const { convertHtmlToMarkdown } = require('./lib/display');

// Validation helpers
function validateDateFormat(dateString, fieldName) {
    if (!dateString) return true;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
        throw new Error(`Invalid ${fieldName} format. Expected YYYY-MM-DD, got: ${dateString}`);
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid ${fieldName} date: ${dateString}`);
    }
    return true;
}

function validateRequired(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        throw new Error(`Missing required parameter: ${fieldName}`);
    }
    return true;
}

function validateGid(gid, fieldName) {
    if (!gid) return true; // Allow empty for optional fields
    if (gid === 'me') return true; // Special case for user GID
    if (!/^\d+$/.test(gid)) {
        throw new Error(`Invalid ${fieldName} format. Expected numeric GID, got: ${gid}`);
    }
    return true;
}

// Helper to expand custom_fields shorthand to include readable data
function expandCustomFields(fields) {
    const expanded = [];
    let hasCustomFields = false;
    
    for (const field of fields) {
        if (field === 'custom_fields') {
            // Expand generic custom_fields to include gid, name, and display_value
            if (!hasCustomFields) {
                expanded.push('custom_fields.gid', 'custom_fields.name', 'custom_fields.display_value');
                hasCustomFields = true;
            }
        } else if (field.startsWith('custom_fields.') && /^custom_fields\.\d+\./.test(field)) {
            // If requesting a specific custom field by GID (e.g., custom_fields.1234.display_value),
            // replace with the generic approach since GID-specific syntax doesn't work well
            if (!hasCustomFields) {
                expanded.push('custom_fields.gid', 'custom_fields.name', 'custom_fields.display_value');
                hasCustomFields = true;
            }
            // Log a warning about the replacement
            // (skip adding the GID-specific field since we're using the generic approach)
        } else {
            expanded.push(field);
        }
    }
    return expanded;
}

// Initialize Asana client
let client, tasksApiInstance, usersApiInstance, projectsApiInstance, storiesApiInstance, sectionsApiInstance, customFieldsApiInstance;
let currentUser = null;

async function initializeAsana() {
    log('info', 'Initializing Asana client');

    if (!process.env.ASANA_API_KEY) {
        log('error', 'Missing ASANA_API_KEY environment variable');
        throw new Error('ASANA_API_KEY environment variable is required');
    }

    const apiInstances = initializeClient();
    client = apiInstances.client;
    tasksApiInstance = apiInstances.tasksApiInstance;
    usersApiInstance = apiInstances.usersApiInstance;
    projectsApiInstance = apiInstances.projectsApiInstance;
    storiesApiInstance = apiInstances.storiesApiInstance;
    sectionsApiInstance = apiInstances.sectionsApiInstance;
    customFieldsApiInstance = apiInstances.customFieldsApiInstance;
    
    // Get current user for workspace context
    currentUser = await getCurrentUser(usersApiInstance);

    log('info', 'Asana client initialized', {
        user: currentUser.name,
        workspace: currentUser.workspaces?.[0]?.name
    });

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
    log('info', 'Tools list requested');

    return {
        tools: [
            {
                name: 'search_tasks',
                description: 'Search for tasks with advanced filters. Supports filtering by assignee, projects, tags, dates, completion status, and more. Use assignee_any="me" for your tasks. Automatically paginates through results (100 per page) using millisecond-precision time-based pagination. Default limit: 100 results for JSON response, 1000 results when saving to file. Default sort: created_at descending (newest first). Supports append mode to add results to existing file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        assignee_any: { type: 'string', description: 'User GID or "me" for your tasks' },
                        projects_any: { type: 'string', description: 'Comma-separated project GIDs (OR logic)' },
                        projects_all: { type: 'string', description: 'Comma-separated project GIDs (AND logic)' },
                        completed: { type: 'boolean', description: 'Filter by completion status' },
                        text: { type: 'string', description: 'Search text in task name/description' },
                        tags_any: { type: 'string', description: 'Comma-separated tag GIDs' },
                        // Due date filters
                        due_on_before: { type: 'string', description: 'Tasks due before date (YYYY-MM-DD)' },
                        due_on_after: { type: 'string', description: 'Tasks due after date (YYYY-MM-DD)' },
                        due_on: { type: 'string', description: 'Tasks due on exact date (YYYY-MM-DD)' },
                        due_at_before: { type: 'string', description: 'Tasks due before timestamp (ISO 8601)' },
                        due_at_after: { type: 'string', description: 'Tasks due after timestamp (ISO 8601)' },
                        // Start date filters
                        start_on_before: { type: 'string', description: 'Tasks starting before date (YYYY-MM-DD)' },
                        start_on_after: { type: 'string', description: 'Tasks starting after date (YYYY-MM-DD)' },
                        start_on: { type: 'string', description: 'Tasks starting on exact date (YYYY-MM-DD)' },
                        // Created date filters
                        created_on_before: { type: 'string', description: 'Tasks created before date (YYYY-MM-DD)' },
                        created_on_after: { type: 'string', description: 'Tasks created after date (YYYY-MM-DD)' },
                        created_on: { type: 'string', description: 'Tasks created on exact date (YYYY-MM-DD)' },
                        created_at_before: { type: 'string', description: 'Tasks created before timestamp (ISO 8601)' },
                        created_at_after: { type: 'string', description: 'Tasks created after timestamp (ISO 8601)' },
                        // Completed date filters
                        completed_on_before: { type: 'string', description: 'Tasks completed before date (YYYY-MM-DD)' },
                        completed_on_after: { type: 'string', description: 'Tasks completed after date (YYYY-MM-DD)' },
                        completed_on: { type: 'string', description: 'Tasks completed on exact date (YYYY-MM-DD)' },
                        completed_at_before: { type: 'string', description: 'Tasks completed before timestamp (ISO 8601)' },
                        completed_at_after: { type: 'string', description: 'Tasks completed after timestamp (ISO 8601)' },
                        // Modified date filters
                        modified_on_before: { type: 'string', description: 'Tasks modified before date (YYYY-MM-DD)' },
                        modified_on_after: { type: 'string', description: 'Tasks modified after date (YYYY-MM-DD)' },
                        modified_on: { type: 'string', description: 'Tasks modified on exact date (YYYY-MM-DD)' },
                        modified_at_before: { type: 'string', description: 'Tasks modified before timestamp (ISO 8601)' },
                        modified_at_after: { type: 'string', description: 'Tasks modified after timestamp (ISO 8601)' },
                        // Sorting and limits
                        sort_by: { type: 'string', description: 'Sort field (e.g., due_date, created_at, modified_at)' },
                        sort_ascending: { type: 'boolean', description: 'Sort in ascending order (default false)' },
                        limit: { type: 'number', description: 'Maximum total results to return (default: 100 for JSON response, 1000 for file output). Automatically paginates 100 per page.', minimum: 1 },
                        // Output options
                        output_file: { type: 'string', description: 'Optional: Save results to file instead of returning JSON. Provide absolute or relative path.' },
                        output_format: { 
                            type: 'string', 
                            description: 'Output format when saving to file: "json" (default), "csv", or "markdown"',
                            enum: ['json', 'csv', 'markdown']
                        },
                        append: { type: 'boolean', description: 'Append to file instead of overwriting (default false). For CSV/markdown, skips headers when appending.' },
                        opt_fields: { 
                            type: 'string', 
                            description: 'Comma-separated list of fields to return. Default: "name,gid,assignee.name,due_on,due_at,projects.name". Available fields: name, gid, completed, notes, html_notes, due_on, due_at, start_on, created_at, modified_at, assignee.name, assignee.gid, projects.name, projects.gid, tags.name, tags.gid, parent.name, parent.gid, memberships.project.name, memberships.project.gid, memberships.section.name, memberships.section.gid, subtasks.name, subtasks.gid, subtasks.completed, num_hearts, num_likes, liked. Use presets: "minimal" (name,gid), "standard" (default), "full" (all common fields).'
                        }
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
                name: 'save_task_notes',
                description: 'Save task description to a file. Use this to: export task content for local review/editing, backup task documentation, create markdown files from Asana tasks, or analyze task descriptions offline. Extracts only the notes field (not full task metadata). Default format is markdown (recommended for readability), but also supports HTML (raw Asana format) or raw text.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_gid: { type: 'string', description: 'Task GID' },
                        file_path: { type: 'string', description: 'Path to save the file (absolute or relative to workspace)' },
                        format: { 
                            type: 'string', 
                            description: 'Output format: "markdown" (default, human-readable), "html" (raw Asana format), or "raw" (plain text)',
                            enum: ['markdown', 'html', 'raw']
                        }
                    },
                    required: ['task_gid', 'file_path']
                }
            },
            {
                name: 'create_task',
                description: `Create a new task. Supports markdown formatting in notes. Use workspace parameter for personal tasks or projects parameter for shared tasks.

FORMATTING GUIDE:
- Markdown is automatically converted to Asana HTML
- Supported: **bold**, *italic*, lists, code blocks, links
- To mention users: Use markdown links [Name](https://app.asana.com/0/profile/USER_GID) - displays as @Name in Asana
- To link to tasks/projects: Use bare URLs https://app.asana.com/0/PROJECT_GID/TASK_GID
- Example: **Owner:** [Alice Smith](https://app.asana.com/0/profile/1234567890123456)`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Task name' },
                        notes: { type: 'string', description: 'Task description in markdown. See description for formatting guide.' },
                        notes_file: { type: 'string', description: 'Path to markdown file for task description' },
                        html_notes_file: { type: 'string', description: 'Path to HTML file for task description (bypasses markdown conversion)' },
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
                description: `Update a task. Supports updating any field including notes (with markdown), assignee, dates, completion status.

FORMATTING GUIDE:
- Markdown is automatically converted to Asana HTML
- Supported: **bold**, *italic*, lists, code blocks, links
- To mention users: Use markdown links [Name](https://app.asana.com/0/profile/USER_GID) - displays as @Name in Asana
- To link to tasks/projects: Use bare URLs https://app.asana.com/0/PROJECT_GID/TASK_GID
- Example: **Owner:** [Alice Smith](https://app.asana.com/0/profile/1234567890123456)`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_gid: { type: 'string', description: 'Task GID' },
                        name: { type: 'string', description: 'New task name' },
                        notes: { type: 'string', description: 'New description in markdown. See description for formatting guide.' },
                        notes_file: { type: 'string', description: 'Path to markdown file for task description' },
                        html_notes_file: { type: 'string', description: 'Path to HTML file for task description (bypasses markdown conversion)' },
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
                description: `Add a comment to a task. Supports markdown formatting.

FORMATTING GUIDE:
- Markdown is automatically converted to Asana HTML
- Supported: **bold**, *italic*, lists, code blocks, links
- To mention users: Use markdown links [Name](https://app.asana.com/0/profile/USER_GID) - displays as @Name in Asana
- To link to tasks/projects: Use bare URLs https://app.asana.com/0/PROJECT_GID/TASK_GID
- Example: **Owner:** [Alice Smith](https://app.asana.com/0/profile/1234567890123456)`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_gid: { type: 'string', description: 'Task GID' },
                        text: { type: 'string', description: 'Comment text in markdown. See description for formatting guide.' }
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
            },
            {
                name: 'extract_task_id',
                description: 'Extract Asana task ID from a URL. Supports v0 URLs (https://app.asana.com/0/...), v1 URLs (https://app.asana.com/1/.../task/...), search results, inbox items, focused mode, and subtask URLs.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: { type: 'string', description: 'The Asana URL to extract task ID from' }
                    },
                    required: ['url']
                }
            },
            {
                name: 'get_project_sections',
                description: 'Get sections for a project. Returns list of sections with name and GID.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        project_gid: { type: 'string', description: 'Project GID' }
                    },
                    required: ['project_gid']
                }
            },
            {
                name: 'get_project_custom_fields',
                description: 'Get custom fields defined for a project. Shows field names, GIDs, types, and possible values (for enum fields). Use this to discover what custom fields are available, then use field names in opt_fields like "custom_fields.FIELD_NAME.display_value" to fetch custom field values in tasks.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        project_gid: { type: 'string', description: 'Project GID' }
                    },
                    required: ['project_gid']
                }
            },
            {
                name: 'get_project_tasks',
                description: 'Get all tasks for a project using efficient offset-based pagination. Faster and more reliable than search_tasks for project-specific queries. Supports fetching notes field directly. Default limit: 100 for JSON response, 1000 for file output. Supports same field customization as search_tasks (minimal, standard, full presets or custom fields).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        project_gid: { type: 'string', description: 'Project GID' },
                        // Completion filters
                        completed: { type: 'boolean', description: 'Filter by completion status (optional)' },
                        completed_since: { type: 'string', description: 'Only tasks completed since this date (YYYY-MM-DD or ISO 8601). API-supported filter, very efficient.' },
                        // Time filters
                        modified_since: { type: 'string', description: 'Only tasks modified since this timestamp (ISO 8601, e.g., 2026-02-01T00:00:00Z). API-supported filter, very efficient.' },
                        // Assignment filters
                        assignee_gid: { type: 'string', description: 'Filter by assignee GID. Use "null" or omit assignee_gid and set unassigned=true for unassigned tasks. Use "me" for your tasks.' },
                        unassigned: { type: 'boolean', description: 'Filter for unassigned tasks (true) or assigned tasks (false). Alternative to assignee_gid="null".' },
                        // Section filter
                        section_gid: { type: 'string', description: 'Filter by section GID. Use get_project_sections to find section GIDs. Client-side filter.' },
                        // Results control
                        limit: { type: 'number', description: 'Maximum total results to return (default: 100 for JSON response, 1000 for file output). Automatically paginates 100 per page.', minimum: 1 },
                        opt_fields: { 
                            type: 'string', 
                            description: 'Comma-separated list of fields to return. Default: "name,gid,assignee.name,due_on,due_at,completed". Use presets: "minimal" (name,gid), "standard" (default), "full" (all common fields including notes). Or specify custom fields.'
                        },
                        // File output
                        output_file: { type: 'string', description: 'Optional: Save results to file instead of returning JSON. Provide absolute or relative path.' },
                        output_format: { 
                            type: 'string', 
                            description: 'Output format when saving to file: "json" (default), "csv", or "markdown"',
                            enum: ['json', 'csv', 'markdown']
                        },
                        append: { type: 'boolean', description: 'Append to file instead of overwriting (default false). For CSV/markdown, skips headers when appending.' }
                    },
                    required: ['project_gid']
                }
            },
            {
                name: 'add_task_to_project',
                description: 'Add task to a project, or move task to a section if already in project. Use get_project_sections to find section GIDs.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_gid: { type: 'string', description: 'Task GID' },
                        project_gid: { type: 'string', description: 'Project GID' },
                        section_gid: { type: 'string', description: 'Section GID within the project (optional)' }
                    },
                    required: ['task_gid', 'project_gid']
                }
            },
            {
                name: 'remove_task_from_project',
                description: 'Remove task from a project.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task_gid: { type: 'string', description: 'Task GID' },
                        project_gid: { type: 'string', description: 'Project GID' }
                    },
                    required: ['task_gid', 'project_gid']
                }
            }
        ]
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const startTime = Date.now();
    const { name, arguments: args } = request.params;

    // Log immediately - sanitize args to avoid logging sensitive data
    const sanitizedArgs = { ...args };
    if (sanitizedArgs.notes && sanitizedArgs.notes.length > 100) {
        sanitizedArgs.notes = sanitizedArgs.notes.substring(0, 100) + '...';
    }
    if (sanitizedArgs.text && sanitizedArgs.text.length > 100) {
        sanitizedArgs.text = sanitizedArgs.text.substring(0, 100) + '...';
    }

    log('info', `Tool called: ${name}`, { args: sanitizedArgs });

    try {
        // Ensure Asana is initialized
        if (!currentUser) {
            log('info', 'Initializing Asana client (first call)');
            await initializeAsana();
        }

        let result;

        switch (name) {
            case 'search_tasks': {
                // Create AbortController for cancellation support
                const abortController = new AbortController();
                
                // Smart default: 100 for response output, 1000 for file output
                const defaultLimit = args.output_file ? 1000 : 100;
                
                const searchOptions = {
                    workspace: currentUser.workspaces[0].gid,
                    limit: 100,  // Fixed per-page limit (Asana's max)
                    maxResults: args.limit !== undefined ? args.limit : defaultLimit,
                    signal: abortController.signal  // Pass cancellation signal
                };

                // Map MCP arguments to Asana API parameters
                // Basic filters
                if (args.assignee_any) searchOptions['assignee.any'] = args.assignee_any;
                if (args.projects_any) searchOptions['projects.any'] = args.projects_any;
                if (args.projects_all) searchOptions['projects.all'] = args.projects_all;
                if (args.completed !== undefined) searchOptions.completed = args.completed;
                if (args.text) searchOptions.text = args.text;
                if (args.tags_any) searchOptions['tags.any'] = args.tags_any;
                
                // Due date filters
                if (args.due_on_before) searchOptions['due_on.before'] = args.due_on_before;
                if (args.due_on_after) searchOptions['due_on.after'] = args.due_on_after;
                if (args.due_on) searchOptions['due_on'] = args.due_on;
                if (args.due_at_before) searchOptions['due_at.before'] = args.due_at_before;
                if (args.due_at_after) searchOptions['due_at.after'] = args.due_at_after;
                
                // Start date filters
                if (args.start_on_before) searchOptions['start_on.before'] = args.start_on_before;
                if (args.start_on_after) searchOptions['start_on.after'] = args.start_on_after;
                if (args.start_on) searchOptions['start_on'] = args.start_on;
                
                // Created date filters
                if (args.created_on_before) searchOptions['created_on.before'] = args.created_on_before;
                if (args.created_on_after) searchOptions['created_on.after'] = args.created_on_after;
                if (args.created_on) searchOptions['created_on'] = args.created_on;
                if (args.created_at_before) searchOptions['created_at.before'] = args.created_at_before;
                if (args.created_at_after) searchOptions['created_at.after'] = args.created_at_after;
                
                // Completed date filters
                if (args.completed_on_before) searchOptions['completed_on.before'] = args.completed_on_before;
                if (args.completed_on_after) searchOptions['completed_on.after'] = args.completed_on_after;
                if (args.completed_on) searchOptions['completed_on'] = args.completed_on;
                if (args.completed_at_before) searchOptions['completed_at.before'] = args.completed_at_before;
                if (args.completed_at_after) searchOptions['completed_at.after'] = args.completed_at_after;
                
                // Modified date filters
                if (args.modified_on_before) searchOptions['modified_on.before'] = args.modified_on_before;
                if (args.modified_on_after) searchOptions['modified_on.after'] = args.modified_on_after;
                if (args.modified_on) searchOptions['modified_on'] = args.modified_on;
                if (args.modified_at_before) searchOptions['modified_at.before'] = args.modified_at_before;
                if (args.modified_at_after) searchOptions['modified_at.after'] = args.modified_at_after;
                
                // Sorting
                if (args.sort_by) searchOptions.sort_by = args.sort_by;
                if (args.sort_ascending !== undefined) searchOptions.sort_ascending = args.sort_ascending;

                // Field selection with presets
                if (args.opt_fields) {
                    const fieldPresets = {
                        'minimal': ['name', 'gid'],
                        'standard': ['name', 'gid', 'assignee.name', 'due_on', 'due_at', 'projects.name'],
                        'full': [
                            'name', 'gid', 'completed', 'notes', 'html_notes',
                            'due_on', 'due_at', 'start_on', 'created_at', 'modified_at',
                            'assignee.name', 'assignee.gid',
                            'projects.name', 'projects.gid',
                            'tags.name', 'tags.gid',
                            'parent.name', 'parent.gid',
                            'memberships.project.name', 'memberships.project.gid',
                            'memberships.section.name', 'memberships.section.gid',
                            'subtasks.name', 'subtasks.gid', 'subtasks.completed',
                            'num_hearts', 'num_likes', 'liked'
                        ]
                    };

                    // Check if it's a preset or custom field list
                    if (fieldPresets[args.opt_fields]) {
                        searchOptions.fields = fieldPresets[args.opt_fields];
                        log('info', 'Using field preset', { preset: args.opt_fields, fieldCount: searchOptions.fields.length });
                    } else {
                        // Parse comma-separated custom fields
                        let fields = args.opt_fields.split(',').map(f => f.trim()).filter(f => f);
                        // Expand 'custom_fields' shorthand to include readable data
                        fields = expandCustomFields(fields);
                        searchOptions.fields = fields;
                        log('info', 'Using custom fields', { fieldCount: searchOptions.fields.length, fields: searchOptions.fields });
                    }
                }

                const tasks = await searchTasks(tasksApiInstance, searchOptions, log);

                // Handle file output
                if (args.output_file) {
                    const outputPath = path.isAbsolute(args.output_file) 
                        ? args.output_file 
                        : path.join(process.cwd(), args.output_file);
                    const format = args.output_format || 'json';
                    const appendMode = args.append === true;
                    const fileExists = fs.existsSync(outputPath);
                    
                    let content;
                    if (format === 'json') {
                        if (appendMode) {
                            // Newline-delimited JSON for append mode
                            content = tasks.map(t => JSON.stringify(t)).join('\n') + '\n';
                        } else {
                            // Pretty JSON array for new file
                            content = JSON.stringify(tasks, null, 2);
                        }
                    } else if (format === 'csv') {
                        // CSV format: GID, Name, Assignee, Due Date, Projects
                        const rows = tasks.map(t => {
                            const name = (t.name || '').replace(/"/g, '""');
                            const assignee = t.assignee?.name || '';
                            const dueDate = t.due_on || t.due_at || '';
                            const projects = (t.projects || []).map(p => p.name).join('; ');
                            return `${t.gid},"${name}","${assignee}","${dueDate}","${projects}"`;
                        }).join('\n');
                        
                        // Include header only if creating new file or appending to non-existent file
                        if (!appendMode || !fileExists) {
                            content = 'GID,Name,Assignee,Due Date,Projects\n' + rows + '\n';
                        } else {
                            content = rows + '\n';
                        }
                    } else if (format === 'markdown') {
                        const rows = tasks.map(t => {
                            const name = (t.name || '').replace(/\|/g, '\\|');
                            const assignee = (t.assignee?.name || '').replace(/\|/g, '\\|');
                            const dueDate = t.due_on || t.due_at || '';
                            const projects = (t.projects || []).map(p => p.name).join(', ').replace(/\|/g, '\\|');
                            return `| ${t.gid} | ${name} | ${assignee} | ${dueDate} | ${projects} |`;
                        }).join('\n');
                        
                        // Include header only if creating new file or appending to non-existent file
                        if (!appendMode || !fileExists) {
                            const header = '# Asana Search Results\n\n| GID | Name | Assignee | Due Date | Projects |\n|-----|------|----------|----------|----------|\n';
                            content = header + rows + '\n';
                        } else {
                            content = rows + '\n';
                        }
                    }
                    
                    // Write or append
                    if (appendMode) {
                        fs.appendFileSync(outputPath, content, 'utf8');
                        log('info', 'Search results appended to file', { 
                            file: outputPath, 
                            format, 
                            tasksAdded: tasks.length,
                            fileExisted: fileExists
                        });
                    } else {
                        fs.writeFileSync(outputPath, content, 'utf8');
                        log('info', 'Search results saved to file', { 
                            file: outputPath, 
                            format, 
                            totalTasks: tasks.length 
                        });
                    }
                    
                    result = {
                        content: [
                            {
                                type: 'text',
                                text: `Search results ${appendMode ? 'appended to' : 'saved to'} ${outputPath}\nFormat: ${format}\nTasks ${appendMode ? 'added' : 'total'}: ${tasks.length}`
                            }
                        ]
                    };
                } else {
                    // Return JSON directly
                    result = {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(tasks, null, 2)
                            }
                        ]
                    };
                }
                break;
            }

            case 'get_task': {
                // Validate required parameters
                validateRequired(args.task_gid, 'task_gid');
                validateGid(args.task_gid, 'task_gid');

                const task = await getTask(tasksApiInstance, args.task_gid);
                const comments = await getTaskStories(storiesApiInstance, args.task_gid, { commentsOnly: true });
                task.commentCount = comments.length;

                result = {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(task, null, 2)
                        }
                    ]
                };
                break;
            }
            
            case 'save_task_notes': {
                // Validate required parameters
                validateRequired(args.task_gid, 'task_gid');
                validateGid(args.task_gid, 'task_gid');
                validateRequired(args.file_path, 'file_path');
                
                const format = args.format || 'markdown';
                
                // Get task details
                const task = await getTask(tasksApiInstance, args.task_gid);
                
                let content = '';
                if (format === 'html' && task.html_notes) {
                    content = task.html_notes;
                } else if (format === 'raw' && task.notes) {
                    content = task.notes;
                } else if (task.html_notes) {
                    // Default: Convert HTML to markdown
                    content = convertHtmlToMarkdown(task.html_notes);
                } else if (task.notes) {
                    content = task.notes;
                } else {
                    throw new Error('Task has no notes/description to save');
                }
                
                // Resolve file path (handle both absolute and relative paths)
                const filePath = path.isAbsolute(args.file_path) 
                    ? args.file_path 
                    : path.resolve(process.cwd(), args.file_path);
                
                // Ensure directory exists
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                // Write file
                fs.writeFileSync(filePath, content, 'utf8');
                
                result = {
                    content: [
                        {
                            type: 'text',
                            text: `Task notes saved successfully!\nTask: ${task.name}\nFormat: ${format}\nFile: ${filePath}\nSize: ${content.length} characters`
                        }
                    ]
                };
                break;
            }

            case 'create_task': {
                // Validate required parameters
                validateRequired(args.name, 'name');

                // Validate dates
                validateDateFormat(args.due_on, 'due_on');
                validateDateFormat(args.start_on, 'start_on');

                // Validate GIDs
                validateGid(args.assignee, 'assignee');
                validateGid(args.parent, 'parent');
                validateGid(args.workspace, 'workspace');

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
                if (args.projects) {
                    // Validate project GIDs
                    const projectGids = args.projects.split(',').map(p => p.trim());
                    projectGids.forEach(gid => validateGid(gid, 'project GID'));
                    taskData.projects = projectGids;
                }
                if (args.parent) taskData.parent = args.parent;
                if (args.due_on) taskData.due_on = args.due_on;
                if (args.start_on) taskData.start_on = args.start_on;

                const task = await createTask(tasksApiInstance, taskData, { convertMarkdown: true });

                result = {
                    content: [
                        {
                            type: 'text',
                            text: `Task created successfully!\nName: ${task.name}\nGID: ${task.gid}\nURL: https://app.asana.com/0/0/${task.gid}`
                        }
                    ]
                };
                break;
            }

            case 'update_task': {
                // Validate required parameters
                validateRequired(args.task_gid, 'task_gid');
                validateGid(args.task_gid, 'task_gid');

                // Validate optional parameters
                validateDateFormat(args.due_on, 'due_on');
                validateDateFormat(args.start_on, 'start_on');
                validateGid(args.assignee, 'assignee');
                validateGid(args.parent, 'parent');

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

                result = {
                    content: [
                        {
                            type: 'text',
                            text: `Task updated successfully!\nName: ${task.name}\nGID: ${task.gid}`
                        }
                    ]
                };
                break;
            }

            case 'add_comment': {
                // Validate required parameters
                validateRequired(args.task_gid, 'task_gid');
                validateRequired(args.text, 'text');
                validateGid(args.task_gid, 'task_gid');

                const comment = await addTaskComment(
                    storiesApiInstance,
                    args.task_gid,
                    { text: args.text },
                    { convertMarkdown: false }
                );

                result = {
                    content: [
                        {
                            type: 'text',
                            text: `Comment added successfully!`
                        }
                    ]
                };
                break;
            }

            case 'get_task_comments': {
                // Validate required parameters
                validateRequired(args.task_gid, 'task_gid');
                validateGid(args.task_gid, 'task_gid');

                const comments = await getTaskStories(storiesApiInstance, args.task_gid, { commentsOnly: true });

                result = {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(comments, null, 2)
                        }
                    ]
                };
                break;
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

                result = {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(projects, null, 2)
                        }
                    ]
                };
                break;
            }

            case 'get_my_tasks': {
                const tasks = await getTasksForUser(
                    tasksApiInstance,
                    'me',
                    currentUser.workspaces[0].gid,
                    { completed: false }
                );

                result = {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(tasks, null, 2)
                        }
                    ]
                };
                break;
            }

            case 'extract_task_id': {
                validateRequired(args.url, 'url');

                const taskId = extractAsanaTaskId(args.url);

                if (taskId) {
                    result = {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({ task_id: taskId, url: args.url }, null, 2)
                            }
                        ]
                    };
                } else {
                    result = {
                        content: [
                            {
                                type: 'text',
                                text: `Error: Could not extract task ID from URL: ${args.url}`
                            }
                        ],
                        isError: true
                    };
                }
                break;
            }
            
            case 'get_project_sections': {
                // Validate required parameters
                validateRequired(args.project_gid, 'project_gid');
                validateGid(args.project_gid, 'project_gid');
                
                const sections = await getSections(sectionsApiInstance, args.project_gid);
                
                result = {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${sections.length} section(s):\n\n` + 
                                  sections.map(s => `- ${s.name} (GID: ${s.gid})`).join('\n')
                        }
                    ]
                };
                break;
            }

            case 'get_project_custom_fields': {
                // Validate required parameters
                validateRequired(args.project_gid, 'project_gid');
                validateGid(args.project_gid, 'project_gid');
                
                // Get project with custom field settings
                const project = await projectsApiInstance.getProject(args.project_gid, {
                    opt_fields: 'name,custom_field_settings.custom_field.name,custom_field_settings.custom_field.gid,custom_field_settings.custom_field.type,custom_field_settings.custom_field.enum_options.name,custom_field_settings.custom_field.enum_options.gid'
                });
                
                const customFields = project.data.custom_field_settings?.map(setting => setting.custom_field) || [];
                
                let text = `Project: ${project.data.name}\n\nCustom Fields (${customFields.length}):\n\n`;
                
                if (customFields.length === 0) {
                    text += 'No custom fields defined for this project.';
                } else {
                    customFields.forEach(field => {
                        text += `**${field.name}**\n`;
                        text += `- GID: ${field.gid}\n`;
                        text += `- Type: ${field.type}\n`;
                        
                        if (field.enum_options && field.enum_options.length > 0) {
                            text += `- Options: ${field.enum_options.map(opt => opt.name).join(', ')}\n`;
                        }
                        
                        text += `- To fetch in tasks: Use \`opt_fields\` with \`custom_fields.${field.gid}.display_value\`\n`;
                        text += `  or \`custom_fields.name,custom_fields.display_value\` to get all custom fields\n\n`;
                    });
                    
                    text += '\n**Example Usage:**\n\n';
                    text += '```json\n';
                    text += '{\n';
                    text += `  "project_gid": "${args.project_gid}",\n`;
                    text += '  "opt_fields": "name,gid,custom_fields.name,custom_fields.display_value"\n';
                    text += '}\n';
                    text += '```';
                }
                
                result = {
                    content: [
                        {
                            type: 'text',
                            text
                        }
                    ]
                };
                break;
            }

            case 'get_project_tasks': {
                // Create AbortController for cancellation support
                const abortController = new AbortController();
                
                // Validate required parameters
                validateRequired(args.project_gid, 'project_gid');
                validateGid(args.project_gid, 'project_gid');
                
                // Smart default: 100 for response output, 1000 for file output
                const defaultLimit = args.output_file ? 1000 : 100;
                
                const fetchOptions = {
                    limit: 100,  // Fixed per-page limit (Asana's max)
                    maxResults: args.limit !== undefined ? args.limit : defaultLimit,
                    signal: abortController.signal  // Pass cancellation signal
                };
                
                // Completion filters
                if (args.completed !== undefined) {
                    fetchOptions.completed = args.completed;
                }
                if (args.completed_since) {
                    fetchOptions.completed_since = args.completed_since;
                }
                
                // Time filters
                if (args.modified_since) {
                    fetchOptions.modified_since = args.modified_since;
                }
                
                // Assignment filters
                if (args.unassigned !== undefined) {
                    fetchOptions.unassigned = args.unassigned;
                } else if (args.assignee_gid) {
                    // Handle "me" shorthand
                    fetchOptions.assignee_gid = args.assignee_gid === 'me' 
                        ? currentUser.gid 
                        : args.assignee_gid;
                }
                
                // Section filter
                if (args.section_gid) {
                    fetchOptions.section_gid = args.section_gid;
                }
                
                // Field selection with presets
                if (args.opt_fields) {
                    const fieldPresets = {
                        'minimal': ['name', 'gid'],
                        'standard': ['name', 'gid', 'assignee.name', 'due_on', 'due_at', 'completed'],
                        'full': [
                            'name', 'gid', 'completed', 'notes', 'html_notes',
                            'due_on', 'due_at', 'start_on', 'created_at', 'modified_at',
                            'assignee.name', 'assignee.gid',
                            'projects.name', 'projects.gid',
                            'tags.name', 'tags.gid',
                            'parent.name', 'parent.gid',
                            'memberships.project.name', 'memberships.project.gid',
                            'memberships.section.name', 'memberships.section.gid',
                            'subtasks.name', 'subtasks.gid', 'subtasks.completed',
                            'num_hearts', 'num_likes', 'liked'
                        ]
                    };

                    // Check if it's a preset or custom field list
                    if (fieldPresets[args.opt_fields]) {
                        fetchOptions.fields = fieldPresets[args.opt_fields];
                        log('info', 'Using field preset', { preset: args.opt_fields, fieldCount: fetchOptions.fields.length });
                    } else {
                        // Parse comma-separated custom fields
                        let fields = args.opt_fields.split(',').map(f => f.trim()).filter(f => f);
                        // Expand 'custom_fields' shorthand to include readable data
                        fields = expandCustomFields(fields);
                        fetchOptions.fields = fields;
                        log('info', 'Using custom fields', { fieldCount: fetchOptions.fields.length, fields: fetchOptions.fields });
                    }
                }

                const tasks = await getTasksForProject(tasksApiInstance, args.project_gid, fetchOptions, log);

                // Handle file output (reuse same logic as search_tasks)
                if (args.output_file) {
                    const outputPath = path.isAbsolute(args.output_file) 
                        ? args.output_file 
                        : path.join(process.cwd(), args.output_file);
                    const format = args.output_format || 'json';
                    const appendMode = args.append === true;
                    const fileExists = fs.existsSync(outputPath);
                    
                    let content;
                    if (format === 'json') {
                        if (appendMode) {
                            // Newline-delimited JSON for append mode
                            content = tasks.map(t => JSON.stringify(t)).join('\n') + '\n';
                        } else {
                            // Pretty JSON array for new file
                            content = JSON.stringify(tasks, null, 2);
                        }
                    } else if (format === 'csv') {
                        // CSV format: GID, Name, Assignee, Due Date, Completed
                        const rows = tasks.map(t => {
                            const name = (t.name || '').replace(/"/g, '""');
                            const assignee = t.assignee?.name || '';
                            const dueDate = t.due_on || t.due_at || '';
                            const completed = t.completed ? 'Yes' : 'No';
                            return `${t.gid},"${name}","${assignee}","${dueDate}","${completed}"`;
                        }).join('\n');
                        
                        // Include header only if creating new file or appending to non-existent file
                        if (!appendMode || !fileExists) {
                            content = 'GID,Name,Assignee,Due Date,Completed\n' + rows + '\n';
                        } else {
                            content = rows + '\n';
                        }
                    } else if (format === 'markdown') {
                        const rows = tasks.map(t => {
                            const name = (t.name || '').replace(/\|/g, '\\|');
                            const assignee = (t.assignee?.name || '').replace(/\|/g, '\\|');
                            const dueDate = t.due_on || t.due_at || '';
                            const completed = t.completed ? '✓' : ' ';
                            return `| ${t.gid} | ${name} | ${assignee} | ${dueDate} | ${completed} |`;
                        }).join('\n');
                        
                        // Include header only if creating new file or appending to non-existent file
                        if (!appendMode || !fileExists) {
                            const header = `# Project Tasks\n\n| GID | Name | Assignee | Due Date | Completed |\n|-----|------|----------|----------|:---------:|\n`;
                            content = header + rows + '\n';
                        } else {
                            content = rows + '\n';
                        }
                    }
                    
                    // Write or append
                    if (appendMode) {
                        fs.appendFileSync(outputPath, content, 'utf8');
                        log('info', 'Project tasks appended to file', { 
                            file: outputPath, 
                            format, 
                            tasksAdded: tasks.length,
                            fileExisted: fileExists
                        });
                    } else {
                        fs.writeFileSync(outputPath, content, 'utf8');
                        log('info', 'Project tasks saved to file', { 
                            file: outputPath, 
                            format, 
                            totalTasks: tasks.length 
                        });
                    }
                    
                    result = {
                        content: [
                            {
                                type: 'text',
                                text: `Project tasks ${appendMode ? 'appended to' : 'saved to'} ${outputPath}\nFormat: ${format}\nTasks ${appendMode ? 'added' : 'total'}: ${tasks.length}`
                            }
                        ]
                    };
                } else {
                    // Return JSON directly
                    result = {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(tasks, null, 2)
                            }
                        ]
                    };
                }
                break;
            }
            
            case 'add_task_to_project': {
                // Validate required parameters
                validateRequired(args.task_gid, 'task_gid');
                validateRequired(args.project_gid, 'project_gid');
                validateGid(args.task_gid, 'task_gid');
                validateGid(args.project_gid, 'project_gid');
                validateGid(args.section_gid, 'section_gid');
                
                await addTaskToProject(
                    tasksApiInstance, 
                    args.task_gid, 
                    args.project_gid, 
                    args.section_gid
                );
                
                let message = `Task ${args.task_gid} `;
                if (args.section_gid) {
                    message += `moved to section ${args.section_gid} in project ${args.project_gid}`;
                } else {
                    message += `added to project ${args.project_gid}`;
                }
                
                result = {
                    content: [
                        {
                            type: 'text',
                            text: message
                        }
                    ]
                };
                break;
            }
            
            case 'remove_task_from_project': {
                // Validate required parameters
                validateRequired(args.task_gid, 'task_gid');
                validateRequired(args.project_gid, 'project_gid');
                validateGid(args.task_gid, 'task_gid');
                validateGid(args.project_gid, 'project_gid');
                
                await removeTaskFromProject(
                    tasksApiInstance, 
                    args.task_gid, 
                    args.project_gid
                );
                
                result = {
                    content: [
                        {
                            type: 'text',
                            text: `Task ${args.task_gid} removed from project ${args.project_gid}`
                        }
                    ]
                };
                break;
            }
            
            default:
                log('error', `Unknown tool: ${name}`);
                throw new Error(`Unknown tool: ${name}`);
        }

        // Log successful completion
        const duration = Date.now() - startTime;
        log('info', `Tool completed: ${name}`, { duration: `${duration}ms` });

        return result;

    } catch (error) {
        // Extract detailed error information
        let errorMessage = error.message;
        let errorDetails = null;

        // Asana API errors have detailed info in response.body
        if (error.response?.body) {
            const body = error.response.body;
            errorDetails = body; // Save full response for logging
            if (body.errors && body.errors.length > 0) {
                errorMessage = body.errors.map(e => e.message).join('; ');
            } else if (body.error) {
                errorMessage = body.error;
            }
        }

        // Log error with full details
        const duration = Date.now() - startTime;
        log('error', `Tool failed: ${name}`, {
            duration: `${duration}ms`,
            error: error.message,
            detailedError: errorMessage,
            asanaResponse: errorDetails,
            stack: error.stack
        });

        // Include stack trace in development mode
        const isDev = process.env.NODE_ENV === 'development';
        const fullError = isDev && error.stack
            ? `${errorMessage}\n\nStack trace:\n${error.stack}`
            : errorMessage;

        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${fullError}`
                }
            ],
            isError: true
        };
    }
});

// Start the server
async function main() {
    try {
        // Log startup info - do this BEFORE any other initialization
        const startupInfo = {
            logFile: LOG_FILE,
            logEnabled: LOG_ENABLED,
            cwd: process.cwd(),
            dirname: __dirname,
            nodeVersion: process.version,
            pid: process.pid
        };

        log('info', 'Starting Asana MCP Server', startupInfo);

        const transport = new StdioServerTransport();
        await server.connect(transport);

        log('info', 'Asana MCP Server started successfully');
    } catch (error) {
        log('error', 'Failed to start server', { error: error.message, stack: error.stack });
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    log('info', 'Received SIGINT, shutting down gracefully');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('info', 'Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

main();
