# Asana Node Helpers

Command-line tools for working with the Asana API using the official [node-asana](https://github.com/Asana/node-asana) library.

## Features

- 🔍 **Search Tasks** - Powerful task search with filters for projects, assignees, dates, tags, and more
- 📋 **Manage Projects** - Find and list projects with caching for performance
- ⚡ **Update Tasks** - Batch update tasks programmatically
- 🎨 **Flexible Output** - Display results as list, table, JSON, or inline format
- 💾 **Smart Caching** - Project data cached for 24 hours to improve performance
- 🚀 **CLI & Module** - Use as command-line tool or import as a Node.js module
- 🛠️ **VSCode Integration** - Pre-configured debug launch configurations

## Requirements

- Node.js 14.0.0 or higher
- Asana account with API access
- Asana API key (personal access token)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Your Asana API Key

1. In Asana, click your **profile picture** (top right)
2. Select **Settings**
3. Go to the **Apps** tab
4. Scroll to the bottom and click **"View developer console"**
5. Click **"Create new token"**
6. Give your token a name and copy it

### 3. Set API Key

Set the `ASANA_API_KEY` environment variable:

```bash
export ASANA_API_KEY=your_api_key_here
```

Or add it to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
echo 'export ASANA_API_KEY=your_api_key_here' >> ~/.zshrc
source ~/.zshrc
```

## CLI Commands

### Show Available Commands

```bash
node index.js
```

### User Commands

#### Get Current User Info

```bash
node index.js user
```

Shows your user information including workspaces.

### Task Commands

#### Fetch Your Incomplete Tasks

```bash
node index.js tasks
```

#### Fetch Your Completed Tasks

```bash
node index.js completed
```

#### Search Tasks

```bash
node index.js search-tasks [options]
```

**Search Options:**

Projects:
- `--projects.any <gid1,gid2>` - Tasks in ANY of the projects (OR)
- `--projects.not <gid1,gid2>` - Tasks NOT in these projects
- `--projects.all <gid1,gid2>` - Tasks in ALL projects (AND)

Sections:
- `--sections.any <gid1,gid2>` - Tasks in ANY of the sections
- `--sections.not <gid1,gid2>` - Tasks NOT in these sections
- `--sections.all <gid1,gid2>` - Tasks in ALL sections

Tags:
- `--tags.any <gid1,gid2>` - Tasks with ANY of the tags
- `--tags.not <gid1,gid2>` - Tasks NOT with these tags
- `--tags.all <gid1,gid2>` - Tasks with ALL tags

Assignee:
- `--assignee.any <gid|me>` - Tasks assigned to user(s)
- `--assignee.not <gid1,gid2>` - Tasks NOT assigned to these users

Teams:
- `--teams.any <gid1,gid2>` - Tasks in these teams

Portfolios:
- `--portfolios.any <gid1,gid2>` - Tasks in these portfolios

Followers:
- `--followers.any <gid1,gid2>` - Tasks followed by these users
- `--followers.not <gid1,gid2>` - Tasks NOT followed by these users

Creators:
- `--created_by.any <gid1,gid2>` - Tasks created by these users
- `--created_by.not <gid1,gid2>` - Tasks NOT created by these users

Assigned by:
- `--assigned_by.any <gid1,gid2>` - Tasks assigned by these users
- `--assigned_by.not <gid1,gid2>` - Tasks NOT assigned by these users

Other filters:
- `--liked_by.not <gid1,gid2>` - Tasks NOT liked by these users
- `--commented_on_by.not <gid1,gid2>` - Tasks NOT commented on by these users

Boolean filters:
- `--completed <true|false>` - Filter by completion status
- `--is_subtask <true|false>` - Filter subtasks
- `--is_blocked <true|false>` - Filter blocked tasks
- `--is_blocking <true|false>` - Filter blocking tasks
- `--has_attachment <true|false>` - Filter tasks with attachments

Date filters:
- `--due_on <date>` - Exact due date (ISO 8601: YYYY-MM-DD)
- `--due_on.before <date>` - Due before date
- `--due_on.after <date>` - Due after date
- `--due_at.before <datetime>` - Due before datetime (ISO 8601)
- `--due_at.after <datetime>` - Due after datetime
- `--start_on <date>` - Exact start date
- `--start_on.before <date>` - Start before date
- `--start_on.after <date>` - Start after date
- `--created_on <date>` - Exact creation date
- `--created_on.before <date>` - Created before date
- `--created_on.after <date>` - Created after date
- `--created_at.before <datetime>` - Created before datetime
- `--created_at.after <datetime>` - Created after datetime
- `--completed_on <date>` - Exact completion date
- `--completed_on.before <date>` - Completed before date
- `--completed_on.after <date>` - Completed after date
- `--completed_at.before <datetime>` - Completed before datetime
- `--completed_at.after <datetime>` - Completed after datetime
- `--modified_on <date>` - Exact modification date
- `--modified_on.before <date>` - Modified before date
- `--modified_on.after <date>` - Modified after date
- `--modified_at.before <datetime>` - Modified before datetime
- `--modified_at.after <datetime>` - Modified after datetime

Text search:
- `--text <search>` - Search text in task name and description

Sorting:
- `--sort_by <field>` - Sort by field: `due_date`, `created_at`, `completed_at`, `likes`, `modified_at`
- `--sort_ascending <true|false>` - Sort direction (default: false)

Display options:
- `--format <list|table|json|inline>` - Output format (default: list)
- `--fields <field1,field2>` - Fields to display (default: name,gid,assignee.name,due_on)

Available fields: `name`, `gid`, `completed`, `assignee.name`, `due_on`, `due_at`, `start_on`, `notes`, `projects.name`, `tags.name`, `created_at`, `modified_at`

**Examples:**

```bash
# Tasks in a specific project
node index.js search-tasks --projects.any 1234567890

# Tasks assigned to me in multiple projects (AND logic)
node index.js search-tasks --projects.all 1234567890,9876543210 --assignee.any me

# Tasks due in 2024
node index.js search-tasks --due_on.after 2023-12-31 --due_on.before 2025-01-01

# Search by text
node index.js search-tasks --text "bug" --is_blocked true --format table

# Tasks assigned to me, incomplete, sorted by due date
node index.js search-tasks --assignee.any me --completed false --sort_by due_date

# Custom fields output
node index.js search-tasks --projects.any 1234567890 --fields name,due_on,assignee.name --format table
```

#### Update Task

```bash
node index.js update-task <task_gid> [options]
```

**Update Options:**

Any task field can be updated:
- `--name <text>` - Update task name
- `--notes <text>` - Update task notes
- `--due_on <date>` - Update due date (ISO 8601: YYYY-MM-DD)
- `--start_on <date>` - Update start date
- `--completed <true|false>` - Mark complete/incomplete
- `--assignee <gid>` - Change assignee

**Examples:**

```bash
# Update task name and due date
node index.js update-task 1234567890 --name "New Task Name" --due_on 2024-12-31

# Mark task complete
node index.js update-task 1234567890 --completed true

# Update start and due dates
node index.js update-task 1234567890 --start_on 2024-03-01 --due_on 2024-03-15
```

### Project Commands

#### Search Projects

```bash
node index.js projects [options]
```

**Search Options:**
- `--name <text>` - Search by project name (partial match)
- `--archived <true|false>` - Filter by archived status
- `--format <list|table|json|inline>` - Output format (default: list)
- `--fields <field1,field2>` - Fields to display (default: name,gid)

Available fields: `name`, `gid`, `archived`, `owner.name`, `color`, `public`, `due_date`, `start_on`, `notes`

**Examples:**

```bash
# Find project by name
node index.js projects --name "My Project"

# Active projects only, table format
node index.js projects --archived false --format table

# Custom fields
node index.js projects --name "API" --fields name,gid,owner.name,due_date
```

### Cache Management

#### Clear Projects Cache

```bash
node index.js clear-cache
```

Projects are cached for 24 hours. Use this to force refresh.

## Using as a Module

```javascript
const {
    getCurrentUser,
    getTasksForUser,
    searchTasks,
    updateTask,
    searchProjects,
    displayTasks,
    displayProjects
} = require('./index');

(async () => {
    // Get current user
    const user = await getCurrentUser();
    
    // Search tasks
    const tasks = await searchTasks({
        workspace: user.workspaces[0].gid,
        'assignee.any': 'me',
        'completed': false
    });
    
    displayTasks(tasks, { format: 'table' });
})();
```

## API Reference

Full Asana search API documentation:
https://developers.asana.com/reference/searchtasksforworkspace

## Project Structure

```
asana-node-helpers/
├── index.js              # Main CLI entry point
├── lib/                  # Feature modules
│   ├── client.js         # Asana client initialization
│   ├── users.js          # User operations
│   ├── tasks.js          # Task operations & search
│   ├── projects.js       # Project operations & search
│   └── display.js        # Display utilities
├── .vscode/              # VSCode debug configurations
│   └── launch.json       # Launch configurations for common tasks
└── .cache/               # Projects cache (24h TTL, gitignored)
```

## Notes

- The search endpoint requires a premium Asana account
- Project search results are cached for 24 hours for performance
- Task search results are not cached (always fetches from API)
- Date formats: Use ISO 8601 (YYYY-MM-DD for dates, full ISO string for datetimes)
- GID format: All Asana resource identifiers are numeric strings

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT - see [LICENSE](LICENSE) file for details
