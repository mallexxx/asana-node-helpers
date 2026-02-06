/**
 * Task-related operations
 */

/**
 * Helper to expand custom_fields shorthand to include readable data
 * @param {Array} fields - Array of field names
 * @returns {Array} Expanded field list
 */
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
            // replace with the generic approach since GID-specific syntax doesn't work as expected
            if (!hasCustomFields) {
                expanded.push('custom_fields.gid', 'custom_fields.name', 'custom_fields.display_value');
                hasCustomFields = true;
            }
            // Skip the GID-specific field since we're using the generic approach
        } else {
            expanded.push(field);
        }
    }
    return expanded;
}

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
            opt_fields: options.opt_fields || 'name,completed,due_on,due_at,start_on,notes,html_notes,assignee.name,assignee.gid,projects.name,projects.gid,tags.name,tags.gid,subtasks.name,subtasks.gid,subtasks.completed,parent.name,parent.gid,memberships.project.name,memberships.project.gid,memberships.section.name,memberships.section.gid,created_at,modified_at,num_hearts,num_likes,liked',
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

        // If this was an HTML-related error, log the HTML for debugging
        if (processedData.html_text && error.message?.includes('XML')) {
            console.error('Generated HTML that caused error:', processedData.html_text);
        }

        throw error;
    }
}

/**
 * Create a new task
 * @param {Object} tasksApiInstance - Asana TasksApi instance
 * @param {object} taskData - Task data (name, notes, projects, etc.)
 * @param {object} options - Optional settings (e.g., { convertMarkdown: true })
 * @returns {Promise} Promise with created task data
 */
async function createTask(tasksApiInstance, taskData, options = {}) {
    let processedTaskData = { ...taskData };
    
    try {
        // Auto-convert markdown if requested and notes field is present
        if (options.convertMarkdown && processedTaskData.notes) {
            console.error('[DEBUG] Converting markdown for create, notes length:', processedTaskData.notes.length);
            const { prepareTaskUpdates } = require('./markdown');
            const converted = prepareTaskUpdates({ notes: processedTaskData.notes });
            
            if (converted.html_notes) {
                console.error('[DEBUG] After conversion, html_notes exists:', true);
                console.error('[DEBUG] html_notes length:', converted.html_notes.length);
                console.error('[DEBUG] First 500 chars:', converted.html_notes.substring(0, 500));
                processedTaskData.html_notes = converted.html_notes;
                delete processedTaskData.notes;
            }
        }
        
        const result = await tasksApiInstance.createTask({ data: processedTaskData });
        return result.data;
    } catch (error) {
        console.error('Error creating task:', error.response?.body || error.message);

        // If this was an HTML-related error, log the HTML for debugging
        if (processedTaskData.html_notes && error.message?.includes('XML')) {
            console.error('Generated HTML that caused error:', processedTaskData.html_notes);
        }

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
    let processedUpdates = { ...updates };
    
    try {
        // Auto-convert markdown if requested and notes field is present
        if (options.convertMarkdown && processedUpdates.notes) {
            console.error('[DEBUG] Converting markdown, notes length:', processedUpdates.notes.length);
            const { prepareTaskUpdates } = require('./markdown');
            processedUpdates = prepareTaskUpdates(processedUpdates);
            console.error('[DEBUG] After conversion, html_notes exists:', !!processedUpdates.html_notes);
            if (processedUpdates.html_notes) {
                console.error('[DEBUG] html_notes length:', processedUpdates.html_notes.length);
                console.error('[DEBUG] First 500 chars:', processedUpdates.html_notes.substring(0, 500));
            }
        }

        const result = await tasksApiInstance.updateTask({ data: processedUpdates }, taskGid);
        return result.data;
    } catch (error) {
        console.error('Error updating task:', error.response?.body || error.message);

        // If this was an HTML-related error, log the HTML for debugging
        if (processedUpdates.html_notes && error.message?.includes('XML')) {
            console.error('Generated HTML that caused error (first 1000 chars):', processedUpdates.html_notes.substring(0, 1000));
            console.error('Generated HTML that caused error (last 500 chars):', processedUpdates.html_notes.substring(processedUpdates.html_notes.length - 500));
        }

        throw error;
    }
}

/**
 * Add task to a project and optionally to a specific section
 * If task is already in the project, it moves to the specified section
 * @param {Object} tasksApiInstance - Asana TasksApi instance
 * @param {string} taskGid - The task GID
 * @param {string} projectGid - The project GID
 * @param {string} sectionGid - Optional section GID within the project
 * @returns {Promise} Promise with result
 */
async function addTaskToProject(tasksApiInstance, taskGid, projectGid, sectionGid = null) {
    try {
        const data = { project: projectGid };
        if (sectionGid) {
            data.section = sectionGid;
        }
        
        const result = await tasksApiInstance.addProjectForTask({ data }, taskGid);
        return result.data;
    } catch (error) {
        console.error('Error adding task to project:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Remove task from a project
 * @param {Object} tasksApiInstance - Asana TasksApi instance
 * @param {string} taskGid - The task GID
 * @param {string} projectGid - The project GID
 * @returns {Promise} Promise with result
 */
async function removeTaskFromProject(tasksApiInstance, taskGid, projectGid) {
    try {
        const result = await tasksApiInstance.removeProjectForTask({ data: { project: projectGid } }, taskGid);
        return result.data;
    } catch (error) {
        console.error('Error removing task from project:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Search tasks with various filters - supports all Asana search API parameters
 * @param {Object} tasksApiInstance - Asana TasksApi instance
 * @param {Object} searchOptions - Search parameters (see Asana API docs for full list)
 * @param {Function} logFn - Optional logging function for pagination progress
 * @returns {Promise<Array>} Array of matching tasks
 */
async function searchTasks(tasksApiInstance, searchOptions = {}, logFn = null) {
    try {
        const signal = searchOptions.signal; // AbortSignal for cancellation support
        const isMCP = process.argv[1]?.includes('mcp-server.js');

        if (!searchOptions.workspace) {
            throw new Error('workspace is required for task search');
        }

        // Default fields - include what's needed for CSV/Markdown output
        const defaultFields = ['name', 'gid', 'assignee.name', 'due_on', 'due_at', 'projects.name'];
        let fieldsToFetch = searchOptions.fields || defaultFields;
        
        // Expand 'custom_fields' shorthand to include readable data
        fieldsToFetch = expandCustomFields(fieldsToFetch);

        // Always include gid
        let opt_fields = fieldsToFetch.includes('gid')
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

        // Debug: Show API query (only in CLI mode, suppress in MCP)
        if (!isMCP) {
            console.error('[DEBUG] API Endpoint: GET /workspaces/' + searchOptions.workspace + '/tasks/search');
            console.error('[DEBUG] API Query Parameters:', JSON.stringify(apiOptions, null, 2));
        }

        // Determine pagination strategy
        const maxResults = searchOptions.maxResults || 100;
        let sortBy = apiOptions.sort_by;
        
        // Default to created_at descending if no sort specified
        if (!sortBy) {
            apiOptions.sort_by = 'created_at';
            apiOptions.sort_ascending = false;
            sortBy = 'created_at';
            if (!isMCP && maxResults > 100) {
                console.error('[Search] Auto-enabled sort_by=created_at (descending) for pagination');
            }
            if (logFn && maxResults > 100) {
                logFn('info', 'Search: Auto-enabled sort_by=created_at (descending) for pagination', { maxResults });
            }
        }
        
        // For limits > 100, validate sorting for pagination
        if (maxResults > 100 && sortBy !== 'created_at' && sortBy !== 'modified_at') {
            // User specified a sort that doesn't support pagination
            throw new Error(
                `Pagination beyond 100 results requires sort_by to be 'created_at' or 'modified_at'. ` +
                `Asana's search API doesn't support offset-based pagination. ` +
                `Current sort_by: '${sortBy}'. ` +
                `Either change sort_by to 'created_at' or 'modified_at', or reduce limit to 100 or less.`
            );
        }
        
        // Determine sort order AFTER potentially modifying apiOptions.sort_ascending above
        const sortAscending = apiOptions.sort_ascending !== false; // default true
        
        // Ensure we fetch the time field needed for sorting/pagination
        const timeField = apiOptions.sort_by === 'modified_at' ? 'modified_at' : 'created_at';
        const useTimePagination = (apiOptions.sort_by === 'created_at' || apiOptions.sort_by === 'modified_at') && maxResults > 100;
        
        // Always include the time field if we're using time-based sorting (even for <= 100 results)
        if ((apiOptions.sort_by === 'created_at' || apiOptions.sort_by === 'modified_at') && 
            !apiOptions.opt_fields.includes(timeField)) {
            apiOptions.opt_fields += `,${timeField}`;
        }
        
        let allTasks = [];

        do {
            // Check for cancellation
            if (signal?.aborted) {
                if (logFn) {
                    logFn('info', 'Search tasks cancelled', { totalFetched: allTasks.length });
                }
                throw new Error('Request cancelled');
            }

            const result = await tasksApiInstance.searchTasksForWorkspace(searchOptions.workspace, apiOptions);
            
            if (result.data.length === 0) {
                break;
            }
            
            allTasks = allTasks.concat(result.data);

            // Check if we've reached the limit
            if (allTasks.length >= maxResults) {
                if (!isMCP) {
                    console.error(`[Search] Reached limit of ${allTasks.length} tasks`);
                }
                break;
            }
            
            // Time-based pagination for created_at/modified_at sorting
            if (useTimePagination && result.data.length === apiOptions.limit) {
                const lastTask = result.data[result.data.length - 1];
                const lastTimestamp = lastTask[timeField];
                
                if (!lastTimestamp) {
                    if (!isMCP) {
                        console.error(`[Search] Cannot paginate: task missing ${timeField} field`);
                    }
                    if (logFn) {
                        logFn('warn', 'Search pagination stopped: task missing time field', { 
                            timeField, 
                            taskGid: lastTask.gid,
                            totalFetched: allTasks.length 
                        });
                    }
                    break;
                }
                
                // Calculate next timestamp: +1ms for ascending, -1ms for descending
                const lastDate = new Date(lastTimestamp);
                const nextDate = new Date(lastDate.getTime() + (sortAscending ? 1 : -1));
                const nextTimestamp = nextDate.toISOString();
                
                // Update the time filter for next page
                if (sortAscending) {
                    apiOptions[`${timeField}.after`] = nextTimestamp;
                } else {
                    apiOptions[`${timeField}.before`] = nextTimestamp;
                }
                
                if (!isMCP) {
                    console.error(`[Search] Fetched ${allTasks.length} tasks, continuing pagination from ${nextTimestamp}`);
                }
                if (logFn) {
                    logFn('info', 'Search pagination: fetching next page', { 
                        totalFetched: allTasks.length,
                        nextTimestamp,
                        timeField,
                        direction: sortAscending ? 'ascending' : 'descending'
                    });
                }
            } else {
                // No more pages (got less than limit or not using time pagination)
                break;
            }
        } while (allTasks.length < maxResults);

        // Client-side text filtering if provided
        if (searchOptions.text) {
            const searchLower = searchOptions.text.toLowerCase();
            allTasks = allTasks.filter(task =>
                task.name.toLowerCase().includes(searchLower)
            );
        }

        // Log final summary
        if (logFn) {
            logFn('info', 'Search completed', { 
                totalResults: allTasks.length,
                maxResults,
                paginationUsed: allTasks.length > 100,
                sortBy: apiOptions.sort_by,
                sortAscending: apiOptions.sort_ascending
            });
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

/**
 * Extract Asana task ID from various URL formats.
 *
 * Supports:
 * - v0 URLs: https://app.asana.com/0/{projectId}/{taskId}
 * - v0 search URLs: https://app.asana.com/0/search/{projectId}/{taskId}
 * - v0 focused mode: https://app.asana.com/0/{projectId}/{taskId}/f
 * - v1 URLs: https://app.asana.com/1/{workspaceId}/task/{taskId}
 * - v1 with project: https://app.asana.com/1/{workspaceId}/project/{projectId}/task/{taskId}
 * - v1 with subtask: https://app.asana.com/1/{workspaceId}/project/{projectId}/task/{taskId}/subtask/{subtaskId}
 * - v1 inbox URLs: https://app.asana.com/1/{workspaceId}/inbox/{inboxId}/item/{itemId}/story/{storyId}
 * - v1 URLs with focus=true: https://app.asana.com/1/{workspaceId}/project/{projectId}/task/{taskId}?focus=true
 *
 * @param {string} url - The Asana URL to extract task ID from
 * @returns {string|null} - The extracted task ID or null if not found
 */
function extractAsanaTaskId(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    try {
        const urlObj = new URL(url);

        // Ensure it's an Asana URL
        if (!urlObj.hostname.includes('asana.com')) {
            return null;
        }

        const path = urlObj.pathname;
        const segments = path.split('/').filter(s => s);

        if (segments.length < 2) {
            return null;
        }

        // v1 URLs: /1/{workspace}/task/{taskId} or /1/{workspace}/project/{projectId}/task/{taskId}
        // or inbox URLs: /1/{workspace}/inbox/{inboxId}/item/{itemId}/...
        if (segments[0] === '1') {
            // Look for /task/ segment first
            const taskIndex = segments.indexOf('task');
            if (taskIndex !== -1 && segments[taskIndex + 1]) {
                return segments[taskIndex + 1];
            }

            // Look for /item/ segment (inbox URLs)
            const itemIndex = segments.indexOf('item');
            if (itemIndex !== -1 && segments[itemIndex + 1]) {
                return segments[itemIndex + 1];
            }

            return null;
        }

        // v0 URLs: /0/{projectId}/{taskId} or /0/search/{projectId}/{taskId} or /0/0/{taskId}/f
        if (segments[0] === '0') {
            const lastSegment = segments[segments.length - 1];

            // If last segment is 'f' (focused mode), return the second-to-last segment
            if (lastSegment === 'f' && segments.length >= 3) {
                return segments[segments.length - 2];
            }

            // Otherwise return the last segment (the task ID)
            return lastSegment;
        }

        return null;
    } catch (error) {
        // Invalid URL
        return null;
    }
}

/**
 * Get tasks for a project with pagination support
 * @param {Object} tasksApiInstance - Asana TasksApi instance
 * @param {string} projectGid - Project GID
 * @param {object} options - Options (limit, maxResults, fields, completed filter, etc.)
 * @param {Function} logFn - Optional logging function (level, message, data)
 * @returns {Promise<Array>} Promise with array of tasks
 */
async function getTasksForProject(tasksApiInstance, projectGid, options = {}, logFn = null) {
    if (!projectGid) {
        throw new Error('projectGid is required');
    }

    const signal = options.signal; // AbortSignal for cancellation support
    const maxResults = options.maxResults || 100;
    const defaultFields = ['name', 'gid', 'assignee.name', 'due_on', 'due_at', 'completed'];
    let fieldsToFetch = options.fields || defaultFields;
    
    // Expand 'custom_fields' shorthand to include readable data
    fieldsToFetch = expandCustomFields(fieldsToFetch);
    
    // Always include gid and fields needed for filtering
    let fieldsArray = fieldsToFetch.includes('gid')
        ? [...fieldsToFetch]
        : ['gid', ...fieldsToFetch];
    
    // Add fields needed for client-side filtering
    if (options.section_gid && !fieldsArray.some(f => f.includes('memberships.section'))) {
        fieldsArray.push('memberships.section.gid');
    }
    if ((options.assignee_gid !== undefined || options.unassigned !== undefined) && 
        !fieldsArray.some(f => f.includes('assignee'))) {
        fieldsArray.push('assignee.gid');
    }
    
    const opt_fields = fieldsArray.join(',');

    const apiOptions = {
        limit: Math.min(options.limit || 100, 100), // Max 100 per page
        opt_fields
    };

    // API-supported filters
    if (options.completed_since) {
        apiOptions.completed_since = options.completed_since;
    }
    if (options.modified_since) {
        apiOptions.modified_since = options.modified_since;
    }

    // Client-side filters
    const completedFilter = options.completed;
    const sectionFilter = options.section_gid;
    const assigneeFilter = options.assignee_gid;
    const unassignedFilter = options.unassigned;

    if (logFn) {
        const filterInfo = {
            projectGid,
            maxResults,
            fieldsCount: fieldsToFetch.length,
            limit: apiOptions.limit
        };
        if (completedFilter !== undefined) filterInfo.completed = completedFilter;
        if (sectionFilter) filterInfo.section_gid = sectionFilter;
        if (assigneeFilter !== undefined) filterInfo.assignee_gid = assigneeFilter;
        if (unassignedFilter !== undefined) filterInfo.unassigned = unassignedFilter;
        if (apiOptions.completed_since) filterInfo.completed_since = apiOptions.completed_since;
        if (apiOptions.modified_since) filterInfo.modified_since = apiOptions.modified_since;
        
        logFn('info', 'Starting project tasks fetch', filterInfo);
    }

    let allTasks = [];
    let offset = null;

    do {
        // Check for cancellation
        if (signal?.aborted) {
            if (logFn) {
                logFn('info', 'Project tasks fetch cancelled', { totalFetched: allTasks.length });
            }
            throw new Error('Request cancelled');
        }

        if (offset) {
            apiOptions.offset = offset;
        }

        const result = await tasksApiInstance.getTasksForProject(projectGid, apiOptions);
        
        if (!result.data || result.data.length === 0) {
            break;
        }

        // Apply client-side filters
        let tasks = result.data;
        
        if (completedFilter !== undefined) {
            tasks = tasks.filter(t => t.completed === completedFilter);
        }
        
        if (sectionFilter) {
            tasks = tasks.filter(t => 
                t.memberships?.some(m => m.section?.gid === sectionFilter)
            );
        }
        
        if (unassignedFilter !== undefined) {
            if (unassignedFilter) {
                // Only unassigned tasks (assignee is null)
                tasks = tasks.filter(t => !t.assignee);
            } else {
                // Only assigned tasks (assignee is not null)
                tasks = tasks.filter(t => t.assignee);
            }
        } else if (assigneeFilter !== undefined) {
            if (assigneeFilter === null || assigneeFilter === 'null') {
                // Filter for unassigned tasks
                tasks = tasks.filter(t => !t.assignee);
            } else {
                // Filter for specific assignee
                tasks = tasks.filter(t => t.assignee?.gid === assigneeFilter);
            }
        }

        allTasks = allTasks.concat(tasks);

        if (logFn && offset) {
            logFn('info', 'Project tasks pagination: fetching next page', {
                totalFetched: allTasks.length,
                offset
            });
        }

        // Check if we've reached max results
        if (allTasks.length >= maxResults) {
            allTasks = allTasks.slice(0, maxResults);
            break;
        }

        // Check for next page
        offset = result._response?.next_page?.offset;
        
        if (!offset) {
            break; // No more pages
        }

    } while (allTasks.length < maxResults);

    if (logFn) {
        logFn('info', 'Project tasks fetch completed', {
            totalResults: allTasks.length,
            maxResults,
            paginationUsed: allTasks.length > 100
        });
    }

    return allTasks;
}

module.exports = {
    getTasksForUser,
    getTask,
    getTaskStories,
    addTaskComment,
    createTask,
    updateTask,
    addTaskToProject,
    removeTaskFromProject,
    searchTasks,
    displaySearchedTasks,
    extractAsanaTaskId,
    getTasksForProject
};
