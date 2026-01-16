/**
 * Task-related operations
 */

/**
 * Get tasks assigned to a specific user
 * @param {Object} tasksApiInstance - Asana TasksApi instance
 * @param {string} userGid - The user GID (can be 'me' for current user)
 * @param {string} workspace - The workspace GID
 * @param {object} options - Optional parameters (limit, opt_fields, etc.)
 * @returns {Promise} Promise with task data
 */
async function getTasksForUser(tasksApiInstance, userGid = 'me', workspace, options = {}) {
    try {
        const opts = {
            assignee: userGid,
            workspace: workspace,
            opt_fields: options.opt_fields || 'name,completed,due_on,due_at,notes,projects.name',
            limit: options.limit || 50,
            ...options
        };

        const result = await tasksApiInstance.getTasks(opts);
        return result.data;
    } catch (error) {
        console.error('Error fetching tasks:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Get a specific task by GID
 * @param {Object} tasksApiInstance - Asana TasksApi instance
 * @param {string} taskGid - The task GID
 * @param {object} options - Optional parameters (opt_fields, etc.)
 * @returns {Promise} Promise with task data
 */
async function getTask(tasksApiInstance, taskGid, options = {}) {
    try {
        const opts = {
            opt_fields: options.opt_fields || 'name,completed,due_on,due_at,start_on,notes,html_notes,assignee.name,assignee.gid,projects.name,projects.gid,tags.name,tags.gid,subtasks.name,subtasks.gid,subtasks.completed,parent.name,parent.gid,created_at,modified_at,num_hearts,num_likes,liked',
            ...options
        };

        const result = await tasksApiInstance.getTask(taskGid, opts);
        return result.data;
    } catch (error) {
        console.error('Error fetching task:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Get stories (comments, updates) for a task
 * @param {Object} storiesApiInstance - Asana StoriesApi instance
 * @param {string} taskGid - The task GID
 * @param {object} options - Optional parameters (filter for comments only, etc.)
 * @returns {Promise} Promise with stories data
 */
async function getTaskStories(storiesApiInstance, taskGid, options = {}) {
    try {
        const opts = {
            opt_fields: options.opt_fields || 'created_at,created_by.name,created_by.gid,resource_subtype,text,type',
            limit: options.limit || 100
        };

        let allStories = [];
        let offset = null;

        do {
            const result = await storiesApiInstance.getStoriesForTask(taskGid, opts);
            allStories = allStories.concat(result.data);
            offset = result._response?.next_page?.offset || null;
            opts.offset = offset;
        } while (offset);

        // Filter for comments only if requested
        if (options.commentsOnly) {
            allStories = allStories.filter(story => story.resource_subtype === 'comment_added');
        }

        return allStories;
    } catch (error) {
        console.error('Error fetching task stories:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Add a comment to a task
 * @param {Object} storiesApiInstance - Asana Stories API instance
 * @param {string} taskGid - Task GID
 * @param {Object} commentData - Comment data (text or html_text)
 * @param {Object} options - Options for markdown conversion
 * @returns {Promise<Object>} Created story
 */
async function addTaskComment(storiesApiInstance, taskGid, commentData, options = {}) {
    try {
        const { convertMarkdown = true } = options;
        
        // Handle markdown conversion
        const processedData = { ...commentData };
        if (processedData.text && convertMarkdown) {
            const { prepareTaskUpdates } = require('./markdown');
            const processed = prepareTaskUpdates({ notes: processedData.text }, convertMarkdown);
            
            if (processed.html_notes) {
                // For comments, use html_text instead of html_notes
                processedData.html_text = processed.html_notes;
                delete processedData.text;
            }
        }
        
        const result = await storiesApiInstance.createStoryForTask({ data: processedData }, taskGid);
        return result.data;
    } catch (error) {
        console.error('Error adding comment:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Create a new task
 * @param {Object} tasksApiInstance - Asana TasksApi instance
 * @param {object} taskData - Task data (name, notes, projects, etc.)
 * @returns {Promise} Promise with created task data
 */
async function createTask(tasksApiInstance, taskData) {
    try {
        const result = await tasksApiInstance.createTask({ data: taskData });
        return result.data;
    } catch (error) {
        console.error('Error creating task:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Update a task
 * @param {Object} tasksApiInstance - Asana TasksApi instance
 * @param {string} taskGid - The task GID
 * @param {object} updates - Fields to update (name, notes, html_notes, due_on, etc.)
 * @param {object} options - Optional settings (e.g., { convertMarkdown: true })
 * @returns {Promise} Promise with updated task data
 */
async function updateTask(tasksApiInstance, taskGid, updates, options = {}) {
    try {
        let processedUpdates = { ...updates };
        
        // Auto-convert markdown if requested and notes field is present
        if (options.convertMarkdown && processedUpdates.notes) {
            const { prepareTaskUpdates } = require('./markdown');
            processedUpdates = prepareTaskUpdates(processedUpdates);
        }
        
        const result = await tasksApiInstance.updateTask({ data: processedUpdates }, taskGid);
        return result.data;
    } catch (error) {
        console.error('Error updating task:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Search tasks with various filters - supports all Asana search API parameters
 * @param {Object} tasksApiInstance - Asana TasksApi instance  
 * @param {Object} searchOptions - Search parameters (see Asana API docs for full list)
 * @returns {Promise<Array>} Array of matching tasks
 */
async function searchTasks(tasksApiInstance, searchOptions = {}) {
    try {
        if (!searchOptions.workspace) {
            throw new Error('workspace is required for task search');
        }
        
        // Default fields
        const defaultFields = ['name', 'gid', 'assignee.name', 'due_on'];
        const fieldsToFetch = searchOptions.fields || defaultFields;
        
        // Always include gid
        const opt_fields = fieldsToFetch.includes('gid') 
            ? fieldsToFetch.join(',')
            : ['gid', ...fieldsToFetch].join(',');
        
        const apiOptions = {
            limit: searchOptions.limit || 100,
            opt_fields: opt_fields
        };
        
        // Map all supported search parameters directly to API
        // Reference: https://developers.asana.com/reference/searchtasksforworkspace
        
        const directParams = [
            // Text search
            'text', 'resource_subtype',
            // Assignee filters
            'assignee.any', 'assignee.not',
            // Portfolio filters
            'portfolios.any',
            // Project filters
            'projects.any', 'projects.not', 'projects.all',
            // Section filters
            'sections.any', 'sections.not', 'sections.all',
            // Tag filters
            'tags.any', 'tags.not', 'tags.all',
            // Team filters
            'teams.any',
            // Follower filters
            'followers.any', 'followers.not',
            // Creator filters
            'created_by.any', 'created_by.not',
            // Assigned by filters
            'assigned_by.any', 'assigned_by.not',
            // Other user filters
            'liked_by.not', 'commented_on_by.not',
            // Due date filters
            'due_on.before', 'due_on.after', 'due_on',
            'due_at.before', 'due_at.after',
            // Start date filters
            'start_on.before', 'start_on.after', 'start_on',
            // Created date filters
            'created_on.before', 'created_on.after', 'created_on',
            'created_at.before', 'created_at.after',
            // Completed date filters
            'completed_on.before', 'completed_on.after', 'completed_on',
            'completed_at.before', 'completed_at.after',
            // Modified date filters
            'modified_on.before', 'modified_on.after', 'modified_on',
            'modified_at.before', 'modified_at.after',
            // Boolean filters
            'is_blocking', 'is_blocked', 'has_attachment', 'completed', 'is_subtask',
            // Sorting
            'sort_by', 'sort_ascending'
        ];
        
        // Copy all matching parameters from searchOptions to apiOptions
        directParams.forEach(param => {
            if (searchOptions[param] !== undefined) {
                apiOptions[param] = searchOptions[param];
            }
        });
        
        // Remove undefined values
        Object.keys(apiOptions).forEach(key => 
            apiOptions[key] === undefined && delete apiOptions[key]
        );
        
        // Debug: Show API query
        console.log('[DEBUG] API Endpoint: GET /workspaces/' + searchOptions.workspace + '/tasks/search');
        console.log('[DEBUG] API Query Parameters:', JSON.stringify(apiOptions, null, 2));
        
        // Use searchTasksForWorkspace instead of getTasks
        let allTasks = [];
        let offset = null;
        
        do {
            if (offset) {
                apiOptions.offset = offset;
            }
            
            const result = await tasksApiInstance.searchTasksForWorkspace(searchOptions.workspace, apiOptions);
            allTasks = allTasks.concat(result.data);
            
            offset = result._response?.next_page?.offset || null;
            
            // Limit total results to avoid too much data
            if (allTasks.length >= (searchOptions.maxResults || 500)) {
                console.log(`[Search] Limiting results to ${allTasks.length} tasks`);
                break;
            }
        } while (offset);
        
        // Client-side text filtering if provided
        if (searchOptions.text) {
            const searchLower = searchOptions.text.toLowerCase();
            allTasks = allTasks.filter(task => 
                task.name.toLowerCase().includes(searchLower)
            );
        }
        
        return allTasks;
    } catch (error) {
        console.error('Error searching tasks:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Display tasks with configurable output
 * @param {Array} tasks - Array of task objects
 * @param {Object} displayOptions - Display configuration
 * @param {Array} displayOptions.fields - Fields to display
 * @param {string} displayOptions.format - Output format: 'list', 'table', 'json', 'inline'
 */
function displaySearchedTasks(tasks, displayOptions = {}) {
    if (!tasks || tasks.length === 0) {
        console.log('No tasks found.');
        return;
    }

    const { format = 'list', fields = ['name', 'gid', 'assignee.name', 'due_on'] } = displayOptions;
    
    // JSON format
    if (format === 'json') {
        console.log(JSON.stringify(tasks, null, 2));
        return;
    }
    
    // Inline format
    if (format === 'inline') {
        console.log(`Found ${tasks.length} task(s):`);
        tasks.forEach(task => {
            const values = fields.map(field => getNestedValue(task, field)).filter(v => v);
            console.log(values.join(', '));
        });
        return;
    }
    
    // Table format
    if (format === 'table') {
        const headers = fields.map(f => f.split('.').pop());
        const rows = tasks.map(task => 
            fields.map(field => String(getNestedValue(task, field) || ''))
        );
        
        const colWidths = headers.map((header, i) => {
            const contentWidth = Math.max(...rows.map(row => row[i].length));
            return Math.max(header.length, contentWidth);
        });
        
        console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join('  '));
        console.log(colWidths.map(w => '-'.repeat(w)).join('  '));
        
        rows.forEach(row => {
            console.log(row.map((cell, i) => cell.padEnd(colWidths[i])).join('  '));
        });
        return;
    }
    
    // List format (default)
    console.log(`Found ${tasks.length} task(s):\n`);
    tasks.forEach((task, index) => {
        const displayFields = fields.map(field => {
            const value = getNestedValue(task, field);
            const label = field.split('.').pop();
            return `${capitalizeFirst(label)}: ${value || 'N/A'}`;
        }).filter(Boolean).join(', ');
        
        console.log(`${index + 1}. ${displayFields}`);
    });
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
    getTasksForUser,
    getTask,
    getTaskStories,
    addTaskComment,
    createTask,
    updateTask,
    searchTasks,
    displaySearchedTasks
};
