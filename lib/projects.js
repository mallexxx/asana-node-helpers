/**
 * Project-related operations
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'projects.json');
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

/**
 * Load projects from cache
 * @param {string} workspace - Workspace GID
 * @returns {Array|null} Cached projects or null if cache is invalid/missing
 */
function loadCache(workspace) {
    try {
        if (!fs.existsSync(CACHE_FILE)) {
            return null;
        }
        
        const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        
        // Check if cache is for the same workspace
        if (cacheData.workspace !== workspace) {
            return null;
        }
        
        // Check if cache is still valid
        const now = Date.now();
        if (now - cacheData.timestamp > CACHE_DURATION_MS) {
            return null;
        }
        
        const isMCP = process.argv[1]?.includes('mcp-server.js');
        if (!isMCP) {
            console.error(`[Cache] Using cached projects (${cacheData.projects.length} projects)`);
        }
        return cacheData.projects;
    } catch (error) {
        console.error('[Cache] Failed to load cache:', error.message);
        return null;
    }
}

/**
 * Save projects to cache
 * @param {string} workspace - Workspace GID
 * @param {Array} projects - Projects to cache
 */
function saveCache(workspace, projects) {
    try {
        ensureCacheDir();
        const cacheData = {
            workspace: workspace,
            timestamp: Date.now(),
            projects: projects
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
        const isMCP = process.argv[1]?.includes('mcp-server.js');
        if (!isMCP) {
            console.error(`[Cache] Saved ${projects.length} projects to cache`);
        }
    } catch (error) {
        console.error('[Cache] Failed to save cache:', error.message);
    }
}

/**
 * Clear projects cache
 */
function clearCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
            const isMCP = process.argv[1]?.includes('mcp-server.js');
            if (!isMCP) {
                console.error('[Cache] Cache cleared');
            }
        }
    } catch (error) {
        console.error('[Cache] Failed to clear cache:', error.message);
    }
}

/**
 * Search and filter projects in a workspace
 * @param {Object} projectsApiInstance - Asana ProjectsApi instance
 * @param {string} workspace - Workspace GID
 * @param {Object} options - Search and filter options
 * @param {string} options.name - Project name to search for (partial match)
 * @param {boolean} options.archived - Filter by archived status (true/false/undefined for all)
 * @param {string} options.team - Team GID to filter by
 * @param {Array} options.fields - Fields to fetch
 * @param {boolean} options.noCache - Skip cache and fetch fresh data
 * @returns {Promise<Array>} Array of matching projects
 */
async function searchProjects(projectsApiInstance, workspace, options = {}) {
    try {
        const isMCP = process.argv[1]?.includes('mcp-server.js');
        
        // Try to load from cache first (unless noCache flag is set)
        let allProjects = null;
        if (!options.noCache) {
            allProjects = loadCache(workspace);
        }
        
        // If no cache or noCache flag, fetch from API
        if (!allProjects) {
            if (!isMCP) {
                console.error('[API] Fetching projects from Asana...');
            }
            
            // Fetch all fields for caching (so future queries can use cached data)
            const opt_fields = 'name,gid,archived,created_at,modified_at,owner.name,notes,color,public,due_date,start_on,team.name';
            
            const apiOptions = {
                workspace: workspace,
                archived: options.archived,
                team: options.team,
                limit: 100,
                opt_fields: opt_fields
            };
            
            // Remove undefined values
            Object.keys(apiOptions).forEach(key => 
                apiOptions[key] === undefined && delete apiOptions[key]
            );
            
            // Fetch all projects with pagination
            allProjects = [];
            let offset = null;
            
            do {
                if (offset) {
                    apiOptions.offset = offset;
                }
                
                const result = await projectsApiInstance.getProjects(apiOptions);
                allProjects = allProjects.concat(result.data);
                
                // Check if there are more results
                offset = result._response?.next_page?.offset || null;
            } while (offset);
            
            if (!isMCP) {
                console.error(`[API] Fetched ${allProjects.length} projects`);
            }
            
            // Save to cache
            saveCache(workspace, allProjects);
        }
        
        // Client-side name filtering (partial match)
        if (options.name) {
            const searchLower = options.name.toLowerCase();
            allProjects = allProjects.filter(project => 
                project.name.toLowerCase().includes(searchLower)
            );
        }
        
        return allProjects;
    } catch (error) {
        console.error('Error fetching projects:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Get sections for a project
 * @param {Object} sectionsApiInstance - Asana SectionsApi instance
 * @param {string} projectGid - The project GID
 * @param {Object} options - Optional parameters (opt_fields, etc.)
 * @returns {Promise<Array>} Array of sections
 */
async function getSections(sectionsApiInstance, projectGid, options = {}) {
    try {
        const opts = {
            opt_fields: options.opt_fields || 'name,gid,created_at',
            limit: 100
        };
        
        let allSections = [];
        let offset = null;
        
        do {
            if (offset) {
                opts.offset = offset;
            }
            
            const result = await sectionsApiInstance.getSectionsForProject(projectGid, opts);
            allSections = allSections.concat(result.data);
            
            offset = result._response?.next_page?.offset || null;
        } while (offset);
        
        return allSections;
    } catch (error) {
        console.error('Error fetching sections:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Display projects with configurable output
 * @param {Array} projects - Array of project objects
 * @param {Object} displayOptions - Display configuration
 * @param {Array} displayOptions.fields - Fields to display (e.g. ['name', 'gid', 'owner.name'])
 * @param {string} displayOptions.format - Output format: 'list' (default), 'table', 'json', 'inline'
 */
function displayProjects(projects, displayOptions = {}) {
    if (!projects || projects.length === 0) {
        console.log('No projects found.');
        return;
    }

    const { format = 'list', fields = ['name', 'gid'] } = displayOptions;
    
    // JSON format
    if (format === 'json') {
        console.log(JSON.stringify(projects, null, 2));
        return;
    }
    
    // Inline format (one line per project, comma-separated)
    if (format === 'inline') {
        console.log(`Found ${projects.length} project(s):`);
        projects.forEach(project => {
            const values = fields.map(field => getNestedValue(project, field)).filter(v => v);
            console.log(values.join(', '));
        });
        return;
    }
    
    // Table format
    if (format === 'table') {
        // Calculate column widths
        const headers = fields.map(f => f.split('.').pop());
        const rows = projects.map(project => 
            fields.map(field => String(getNestedValue(project, field) || ''))
        );
        
        const colWidths = headers.map((header, i) => {
            const contentWidth = Math.max(...rows.map(row => row[i].length));
            return Math.max(header.length, contentWidth);
        });
        
        // Print header
        const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
        console.log(headerLine);
        console.log(colWidths.map(w => '-'.repeat(w)).join('  '));
        
        // Print rows
        rows.forEach(row => {
            console.log(row.map((cell, i) => cell.padEnd(colWidths[i])).join('  '));
        });
        return;
    }
    
    // List format (default)
    console.log(`Found ${projects.length} project(s):\n`);
    projects.forEach((project, index) => {
        const displayFields = fields.map(field => {
            const value = getNestedValue(project, field);
            const label = field.split('.').pop();
            return `${capitalizeFirst(label)}: ${value}`;
        }).filter(Boolean).join(', ');
        
        console.log(`${index + 1}. ${displayFields}`);
    });
}

/**
 * Get nested property value from object (e.g., 'owner.name')
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Display sections with configurable output
 * @param {Array} sections - Array of section objects
 * @param {Object} displayOptions - Display configuration
 */
function displaySections(sections, displayOptions = {}) {
    if (!sections || sections.length === 0) {
        console.log('No sections found.');
        return;
    }

    const { format = 'list', fields = ['name', 'gid'] } = displayOptions;
    
    if (format === 'json') {
        console.log(JSON.stringify(sections, null, 2));
        return;
    }
    
    console.log(`Found ${sections.length} section(s):\n`);
    sections.forEach((section, index) => {
        const displayFields = fields.map(field => {
            const value = getNestedValue(section, field);
            const label = field.split('.').pop();
            return `${capitalizeFirst(label)}: ${value}`;
        }).filter(Boolean).join(', ');
        
        console.log(`${index + 1}. ${displayFields}`);
    });
}

module.exports = {
    searchProjects,
    displayProjects,
    getSections,
    displaySections,
    clearCache
};
