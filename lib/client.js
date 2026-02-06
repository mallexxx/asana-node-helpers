const Asana = require('asana');

/**
 * Initialize and configure the Asana client
 * Validates that ASANA_API_KEY is set
 * @returns {Object} Object containing client and API instances
 */
function initializeClient() {
    // Check if ASANA_API_KEY is set
    if (!process.env.ASANA_API_KEY) {
        console.error('Error: ASANA_API_KEY environment variable is not set');
        console.error('Please set your Asana API key: export ASANA_API_KEY=your_api_key_here');
        process.exit(1);
    }

    // Initialize Asana client
    const client = new Asana.ApiClient();
    client.authentications.token.accessToken = process.env.ASANA_API_KEY;

    // Create API instances
    const tasksApiInstance = new Asana.TasksApi(client);
    const usersApiInstance = new Asana.UsersApi(client);
    const projectsApiInstance = new Asana.ProjectsApi(client);
    const workspacesApiInstance = new Asana.WorkspacesApi(client);
    const storiesApiInstance = new Asana.StoriesApi(client);
    const sectionsApiInstance = new Asana.SectionsApi(client);
    const customFieldsApiInstance = new Asana.CustomFieldsApi(client);

    return {
        client,
        tasksApiInstance,
        usersApiInstance,
        projectsApiInstance,
        workspacesApiInstance,
        storiesApiInstance,
        sectionsApiInstance,
        customFieldsApiInstance
    };
}

module.exports = {
    initializeClient
};
