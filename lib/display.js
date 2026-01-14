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
function displayTaskDetails(task) {
    if (!task) {
        console.log('No task data provided.');
        return;
    }

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
    
    if (task.notes) {
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
