# Asana Node Helpers

Command-line tools for working with the Asana API using the official [node-asana](https://github.com/Asana/node-asana) library.

## Features

- 🔍 **Search Tasks** - Powerful task search with filters for projects, assignees, dates, tags, and more
- 📋 **Manage Projects** - Find and list projects with caching for performance
- ⚡ **Update Tasks** - Batch update tasks programmatically
- 💬 **Add Comments** - Post comments with markdown formatting
- 🎨 **Flexible Output** - Display results as list, table, JSON, or inline format
- 💾 **Smart Caching** - Project data cached for 24 hours to improve performance
- 🚀 **CLI & Module** - Use as command-line tool or import as a Node.js module
- 🤖 **MCP Server** - Expose as Model Context Protocol server for AI assistants
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

### Troubleshooting: Certificate Errors

If you encounter SSL certificate errors (e.g., "unable to verify the first certificate" or "self signed certificate in certificate chain"), especially when running from Cursor or behind corporate proxies, you can disable TLS certificate validation:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 node index.js search-tasks --assignee.any me
```

⚠️ **Note:** Disabling certificate verification should only be used in development environments. This makes your connection less secure.

## Formatting Support

### File Uploads
- **Markdown files** (`.md`, `.markdown`, `.mdown`, `.mkd`, `.mdx`, `.mdc`): Automatically converted to Asana HTML
- **HTML files** (`.html`, `.htm`): Cleaned up and used directly
- **No extension**: Treated as markdown (default)

### Task Display
- `node index.js task <gid>` - Default: Markdown format
- `node index.js task <gid> --format html` - Raw HTML
- `node index.js task <gid> --format raw` - Plain text

### Asana HTML Limitations
Asana supports: h1, h2, strong, em, ul, ol, li, code, pre, a, hr, tables.  
Not supported: h3-h6 (converted to h2), p, br, blockquote.

## MCP Server (Model Context Protocol)

This project can be used as an MCP server, making Asana functionality available to AI assistants like Claude Desktop, Cursor agents, and other MCP-compatible clients.

### What is MCP?

Model Context Protocol (MCP) allows AI assistants to access external tools and data sources. With this MCP server, Cursor agents and other AI assistants can:
- Search and filter tasks with natural language
- Create and update tasks with markdown formatting
- Add comments to tasks
- Search for projects
- Get task details including subtasks and comments

### Logging

The MCP server automatically logs all operations to `mcp-server.log` in the project directory (gitignored). 

**Logged events:**
- Server start/stop and initialization
- All tool calls with arguments
- Tool execution time and results
- Errors with full stack traces
- Validation failures

**Log format:** JSON lines for easy parsing
```json
{"timestamp":"2026-01-19T12:34:56.789Z","level":"info","message":"Tool called: create_task","data":{"args":{"name":"Test"}}}
{"timestamp":"2026-01-19T12:34:57.123Z","level":"info","message":"Tool completed: create_task","data":{"duration":"334ms"}}
```

**Disable logging:** Set `MCP_LOG=false` in your MCP config environment variables.

### Setup for Cursor IDE

1. **Clone this repository:**

```bash
git clone https://github.com/mallexxx/asana-node-helpers.git
cd asana-node-helpers
```

2. **Install dependencies:**

```bash
npm install
```

3. **Configure Cursor MCP Settings:**

Add to your Cursor MCP settings (`.cursor/mcp_settings.json` in your project or global settings):

```json
{
  "mcpServers": {
    "asana": {
      "command": "node",
      "args": [
        "/Users/yourusername/path/to/asana-node-helpers/mcp-server.js"
      ],
      "env": {
        "ASANA_API_KEY": "your_asana_api_key_here",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        "MCP_LOG": "true"
      }
    }
  }
}
```

**Environment Variables:**
- `ASANA_API_KEY` (required): Your Asana personal access token
- `NODE_TLS_REJECT_UNAUTHORIZED` (optional): Set to "0" to disable SSL certificate verification (for corporate proxies)
- `MCP_LOG` (optional): Set to "false" to disable logging (enabled by default)
- `NODE_ENV` (optional): Set to "development" to include stack traces in error responses
```

Replace `/path/to/asana-node-helpers` with your actual clone location. You can find it by running `pwd` in the cloned directory.

4. **Restart Cursor IDE**

Cursor agents will now have access to Asana tools!

### Available MCP Tools

- `search_tasks` - Search with filters (assignee, projects, dates, completion status, text, tags)
- `get_task` - Get detailed task information (notes, subtasks, projects, comments count, metadata)
- `save_task_notes` - **Export task notes to file** - Save task description/notes for local review, editing, backup, or analysis. Extracts only the notes field (not full task metadata). Supports markdown (default, human-readable), HTML (raw Asana format), or raw text. Use this when you need to work with task content offline or create documentation from Asana tasks.
- `create_task` - Create new tasks (supports markdown)
- `update_task` - Update any task field (name, notes, assignee, dates, completion, etc.)
- `add_comment` - Add comments (supports markdown)
- `get_task_comments` - Get all comments for a task
- `search_projects` - Find projects by name
- `get_my_tasks` - Quick access to your incomplete tasks
- `get_project_sections` - List sections in a project
- `add_task_to_project` - Add task to project or move to section
- `remove_task_from_project` - Remove task from project

### Formatting Guide for Task Notes and Comments

When creating or updating tasks through the MCP server, markdown is automatically converted to Asana-compatible HTML. Follow these guidelines for best results:

**Supported Markdown Features:**
- **Bold text:** `**bold**`
- *Italic text:* `*italic*`
- Lists (bullet and numbered)
- Code blocks (triple backticks)
- Links: `[text](url)`

**Linking to Asana Users and Resources:**

To mention users in task descriptions or comments, use markdown link syntax with Asana profile URLs:
```markdown
**Owner:** [Alice Smith](https://app.asana.com/0/profile/1234567890123456)
```
This will display as "@Alice Smith" in Asana (a clickable user mention).

**When exporting:** User mentions are preserved in this same markdown link format, making them reversible - you can save task notes to a file, edit them, and upload them back to Asana without losing the user mentions.

You can also use bare URLs for users, tasks, or projects:
```markdown
**Owner:** https://app.asana.com/0/profile/1234567890123456
**Task:** https://app.asana.com/0/9876543210987654/1234567890123456
```

**URL Formats:**
- **User profiles:** `https://app.asana.com/0/profile/USER_GID` or `[Name](https://app.asana.com/0/profile/USER_GID)`
- **Tasks:** `https://app.asana.com/0/PROJECT_GID/TASK_GID`
- **Projects:** `https://app.asana.com/0/PROJECT_GID/list`

**Example Task Description:**
```markdown
**Owner:** https://app.asana.com/0/profile/1234567890123456
**Flag name:** `autocompleteTabs`
**Associated Project:** https://app.asana.com/0/9876543210987654/list

**Additional Information:**
- Default Value: true
- Purpose: Enable tab autocomplete feature
- Added: January 15, 2026

See related task: https://app.asana.com/0/9876543210987654/1234567890123456
```

### Example Usage with Cursor Agents

**Natural language queries that work:**

- "Show me my incomplete tasks"
- "Create a task called 'Review PR' assigned to me with due date next Friday"
- "Find all tasks in the Native Apps project that are overdue"
- "Add a comment to task 1234567890 saying 'Fixed in latest commit'"
- "Update task 1234567890 to mark it complete"
- "Search for projects with 'Marketing' in the name"

### Parameter Validation

The MCP server validates parameters before sending requests to Asana:

**Validated fields:**
- **Required parameters:** Task names, GIDs, comment text
- **Date formats:** Must be YYYY-MM-DD (e.g., 2026-02-14)
- **GID formats:** Must be numeric (except 'me' for user references)
- **Project lists:** Comma-separated GIDs are validated individually

**Validation errors you might see:**
```
Error: Missing required parameter: name
Error: Missing required parameter: task_gid
Error: Invalid due_on format. Expected YYYY-MM-DD, got: 2026/02/14
Error: Invalid task_gid format. Expected numeric GID, got: abc123
Error: Invalid project GID format. Expected numeric GID, got: invalid-id
```

### Error Handling

The MCP server provides detailed error messages when operations fail:

- **Validation errors:** Caught before API calls (see above)
- **File errors:** "Failed to read notes file: [details]"
- **Asana API errors:** Full error messages from Asana API (e.g., permission issues, not found)
- **Unknown tool errors:** "Unknown tool: [tool_name]"
- **Development mode:** Set `NODE_ENV=development` in MCP config to include stack traces

**Example error responses:**
```
Error: Missing required parameter: task_gid
Error: Invalid due_on format. Expected YYYY-MM-DD, got: 02-14-2026
Error: You should specify one of workspace, parent, or projects
Error: Task not found
Error: Failed to read notes file: ENOENT: no such file or directory
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

Fetches all incomplete tasks assigned to YOU in your default workspace:

```bash
node index.js tasks
```

#### Fetch Your Completed Tasks

Fetches your last 20 completed tasks in your default workspace:

```bash
node index.js completed
```

**Note:** For more advanced task queries (filtering by project, date, status, etc.), use the `search-tasks` command instead.

#### Get Task Details

Get detailed information about a specific task by its GID:

```bash
node index.js task <task_gid> [--format markdown|html|text]
```

**Format Options:**
- `markdown` (default) - Shows notes with clean markdown formatting (bold, lists, code blocks, links)
- `html` - Shows raw HTML from Asana (useful for debugging or copying formatted content)
- `text` - Shows plain text without any formatting

**Examples:**

```bash
# Get details with default markdown formatting
node index.js task 1234567890

# View raw HTML
node index.js task 1234567890 --format html

# View stripped plain text
node index.js task 1234567890 --format text
```

**Output includes:**
- Task name and GID
- Completion status
- Assignee
- Start date (if set)
- Due date
- Parent task (if this is a subtask)
- Projects (with names and GIDs)
- Tags (with names and GIDs)
- Subtasks (with names, GIDs, and completion status)
- Number of likes/hearts
- Number of comments
- Full notes/description (formatted as markdown by default)

**⚠️ Important Note About Task Descriptions:**

By default, task descriptions are displayed as **clean markdown** (converted from HTML). This ensures:
- Proper formatting with **bold**, *italic*, `code`, and lists
- Clickable links displayed as `[text](url)`
- User @mentions shown as `[@Name](url)`
- Agents see properly formatted text and won't break formatting when updating

**When updating task descriptions:**
- The `update-task` command automatically converts markdown to HTML (use `--markdown false` to disable)
- To preserve full formatting including @mentions, use `--html_notes` with raw HTML

**How to get a task GID:**
- From Asana URL: `https://app.asana.com/0/PROJECT_ID/TASK_GID` - the last number is the task GID
- From search results when using `--fields gid`
- From the "tasks" or "completed" commands output

#### Get Task Comments/Discussion

Get all comments and discussion for a specific task:

```bash
node index.js task-comments <task_gid>
```

**Example:**

```bash
# Get all comments for task with GID 1234567890
node index.js task-comments 1234567890
```

**Output includes:**
- Comment count
- Each comment with:
  - Author name and GID
  - Timestamp
  - Comment text

#### Save Task Notes to File

Save task notes/description to a file in markdown, HTML, or raw text format:

```bash
node index.js save-task-notes <task_gid> --file <path> [--format markdown|html|raw]
```

**Options:**
- `--file <path>` - File path to save notes (required)
- `--format <type>` - Output format (default: markdown)
  - `markdown` - Converts HTML notes to clean markdown
  - `html` - Saves raw HTML from Asana
  - `raw` - Saves plain text from notes field

**Examples:**

```bash
# Save task notes as markdown
node index.js save-task-notes 1234567890 --file task-notes.md

# Save as HTML for inspection
node index.js save-task-notes 1234567890 --file task.html --format html

# Save plain text only
node index.js save-task-notes 1234567890 --file task.txt --format raw
```

**Note:** When exporting to markdown format, user mentions are preserved as markdown links (e.g., `[Alice Smith](https://app.asana.com/0/profile/123)`). This format is **reversible** - you can edit the file and upload it back to Asana, and the mentions will be converted back to proper clickable user mentions.

**Note:** The comment count is also displayed when using the `task <gid>` command.

#### Add Comment to Task

Add a comment to a task with markdown support:

```bash
node index.js add-comment <task_gid> --text "Comment text" [--markdown false]
```

**Options:**
- `--text <text>` - Comment text (markdown auto-converted by default)
- `--html_text <html>` - Comment text in HTML format
- `--markdown <false>` - Disable automatic markdown conversion

**Examples:**

```bash
# Add a simple comment
node index.js add-comment 1234567890 --text "Great work!"

# Add a comment with markdown formatting
node index.js add-comment 1234567890 --text "**Important:** This needs review by EOD

- Check the tests
- Verify the documentation
- Run benchmarks"

# Add plain text comment without markdown conversion
node index.js add-comment 1234567890 --text "Keep ** symbols visible" --markdown false

# Add comment with HTML (for @mentions)
node index.js add-comment 1234567890 --html_text '<body><a href="..." data-asana-gid="123" data-asana-type="user">@John</a> can you review?</body>'
```

**Markdown Formatting:**
- Markdown in `--text` is automatically converted to formatted HTML by default
- Supports **bold**, *italic*, `code`, lists, and links
- Use `--markdown false` to disable conversion and keep markdown symbols visible
- Use `--html_text` for advanced formatting like @mentions (requires proper HTML with Asana data attributes)

#### Search Tasks

```bash
node index.js search-tasks [options]
```

**Quick Reference:**
- Use `--assignee.any me` to search YOUR tasks
- Use `--completed false` for incomplete tasks
- Use `--completed true` for completed tasks
- Use `--due_on.before YYYY-MM-DD` for tasks due before a date (overdue if date is today)
- Use `--due_on.after YYYY-MM-DD` for tasks due after a date
- Use `--sort_by due_date --sort_ascending true` to sort by due date (oldest first)

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

**Note on Date Format:**
- Dates must be in ISO 8601 format: `YYYY-MM-DD` (e.g., `2026-01-31`)
- Datetimes must be in full ISO 8601 format (e.g., `2026-01-31T12:00:00Z`)
- For "today" or dynamic dates, you can use shell commands like `$(date +%Y-%m-%d)` on macOS/Linux

**Common Use Cases:**

```bash
# My incomplete tasks
node index.js search-tasks --assignee.any me --completed false

# My incomplete tasks sorted by due date (ascending)
node index.js search-tasks --assignee.any me --completed false --sort_by due_date --sort_ascending true

# My completed tasks
node index.js search-tasks --assignee.any me --completed true

# My overdue/outdated tasks (due date in the past)
# Option 1: Using shell command for today's date
node index.js search-tasks --assignee.any me --completed false --due_on.before $(date +%Y-%m-%d)
# Option 2: Using a specific date (e.g., checking tasks overdue as of 2026-01-15)
node index.js search-tasks --assignee.any me --completed false --due_on.before 2026-01-15

# My tasks due this week
node index.js search-tasks --assignee.any me --due_on.after $(date +%Y-%m-%d) --due_on.before $(date -v+7d +%Y-%m-%d)

# My tasks with specific due date
node index.js search-tasks --assignee.any me --due_on 2026-01-31

# My tasks due before a specific date
node index.js search-tasks --assignee.any me --due_on.before 2026-02-01

# My tasks due after a specific date
node index.js search-tasks --assignee.any me --due_on.after 2026-01-01
```

**More Examples:**

```bash
# Tasks in a specific project
node index.js search-tasks --projects.any 1234567890

# Tasks assigned to me in multiple projects (AND logic)
node index.js search-tasks --projects.all 1234567890,9876543210 --assignee.any me

# Tasks due in a specific year (e.g., 2024)
node index.js search-tasks --due_on.after 2023-12-31 --due_on.before 2025-01-01

# Search by text with table format
node index.js search-tasks --text "bug" --is_blocked true --format table

# Custom fields output
node index.js search-tasks --projects.any 1234567890 --fields name,due_on,assignee.name --format table
```

#### Create Task

Create a new task in Asana:

```bash
node index.js create-task --name "Task Name" [options]
```

**Required:**
- `--name <text>` - Task name

**Optional:**
- `--notes <text>` - Task description (markdown supported by default)
- `--notes-file <path>` - Read task description from markdown file
- `--html_notes <html>` - Task description in HTML
- `--html_notes-file <path>` - Read task description from HTML file
- `--projects <gid>` - Project GID (comma-separated for multiple: `123,456,789`)
- `--workspace <gid>` - Workspace GID (for personal tasks not in any project)
- `--parent <gid>` - Parent task GID (creates as subtask)
- `--assignee <gid>` - User GID (use `me` for yourself)
- `--due_on <date>` - Due date (YYYY-MM-DD)
- `--due_at <datetime>` - Due datetime (ISO 8601)
- `--start_on <date>` - Start date (YYYY-MM-DD)
- `--completed <true|false>` - Completion status
- `--markdown <false>` - Disable markdown conversion (default: true)

**Examples:**

```bash
# Create a simple task assigned to yourself
node index.js create-task --name "Review PR" --assignee me

# Create a task with markdown description in a project
node index.js create-task \
  --name "Feature: Add dark mode" \
  --notes "**Requirements:**
- Toggle button in settings
- Save preference to localStorage
- Apply theme on load" \
  --projects 1234567890 \
  --assignee me \
  --due_on 2026-02-28

# Create a task in multiple projects
node index.js create-task \
  --name "Update documentation" \
  --projects "1234567890,9876543210" \
  --assignee me

# Create a subtask under an existing task
node index.js create-task \
  --name "Write unit tests" \
  --parent 1234567890 \
  --assignee me \
  --due_on 2026-02-15

# Create a task with description from a markdown file
node index.js create-task \
  --name "Feature specification" \
  --notes-file ./docs/feature-spec.md \
  --assignee me \
  --projects 1234567890
```

**Markdown Formatting:**
- Markdown in `--notes` is automatically converted to formatted HTML by default
- Lists, **bold**, *italic*, `code`, and links are all supported
- Use `--markdown false` to store plain text without conversion

#### Update Task

```bash
node index.js update-task <task_gid> [options]
```

**Update Options:**

Any task field can be updated:
- `--name <text>` - Update task name
- `--notes <text>` - Update task notes/description (markdown converted by default)
- `--notes-file <path>` - Read description from markdown file
- `--html_notes <html>` - Update task notes with HTML formatting
- `--html_notes-file <path>` - Read description from HTML file
- `--markdown <false>` - Disable markdown conversion (stores plain text with visible ** symbols)
- `--parent <gid>` - Move task to be a subtask of another task
- `--due_on <date>` - Update due date (ISO 8601: YYYY-MM-DD)
- `--start_on <date>` - Update start date
- `--completed <true|false>` - Mark complete/incomplete
- `--assignee <gid>` - Change assignee

**Formatting Behavior:**

By default, markdown in `--notes` is **automatically converted** to formatted HTML:

```bash
# Default behavior - markdown is converted automatically ✅
node index.js update-task 123 --notes "**Bold** text and [link](url)"
# Result: Bold text with clickable link in Asana
```

**To disable markdown conversion** (store plain text with literal ** symbols):

```bash
# Use --markdown false to disable conversion
node index.js update-task 123 --notes "Literal **asterisks** shown" --markdown false
# Result: The ** symbols will be visible as plain text
```

**Formatting Options:**

- `--notes` (default) = **Markdown automatically converted** to formatted HTML
- `--notes` + `--markdown false` = Plain text only, markdown symbols stored literally
- `--html_notes` = Use HTML directly (required for @mentions and task references)

**When copying/editing existing task descriptions:**

If a task already has formatting (bold, links, @mentions), you MUST use `--html_notes` to preserve it:

1. **Get the HTML version via API:**
   ```bash
   # Fetch html_notes field directly (not shown in task command output)
   # Use the Asana API or check the task in Asana's web interface
   ```

2. **Don't copy from `task` command output** - it shows plain text which loses:
   - Link display text (shows only URLs)
   - User @mention metadata
   - Special Asana formatting

3. **Use `--markdown true` only for NEW content** - it creates basic links but won't preserve Asana @mentions

**Examples:**

```bash
# Update task name and due date
node index.js update-task 1234567890 --name "New Task Name" --due_on 2024-12-31

# Mark task complete
node index.js update-task 1234567890 --completed true

# Update start and due dates
node index.js update-task 1234567890 --start_on 2024-03-01 --due_on 2024-03-15

# Move task to be a subtask of another task
node index.js update-task 1234567890 --parent 9876543210

# Update description from a markdown file
node index.js update-task 1234567890 --notes-file ./docs/updated-description.md

# Update description with markdown (converted automatically by default)
node index.js update-task 1234567890 --notes "**Bold text** and [link](https://example.com)
- List item 1
- List item 2"

# Plain text update with literal ** symbols (disable markdown conversion)
node index.js update-task 1234567890 --notes "Plain text with **literal asterisks**" --markdown false

# Update description with HTML directly (for @mentions)
node index.js update-task 1234567890 --html_notes "<body><strong>Bold</strong><br><ul><li>Item 1</li></ul></body>"
```

**Markdown Conversion (Automatic by Default):**

When using `--notes`, markdown is automatically converted to formatted HTML:
- `**bold**` or `__bold__` → Bold text in Asana
- `*italic*` or `_italic_` → Italic text in Asana
- `[Link text](url)` → Clickable link in Asana
- `# Heading` → Heading formatting
- `- List item` → Line breaks (Asana has limited list support)
- `` `code` `` → Code formatting

**When to use each option:**

1. **`--notes` (default)** - Use for normal text with markdown formatting
   - ✅ Bold, italic, links work great
   - ✅ Simple and intuitive
   - ❌ Can't create @mentions (need HTML for that)

2. **`--notes` + `--markdown false`** - Use for literal text with ** symbols
   - ✅ Stores text exactly as written
   - ❌ No formatting - ** and [] visible as plain text

3. **`--html_notes`** - Use for advanced Asana features
   - ✅ @mentions with profile pictures
   - ✅ Task references with special attributes
   - ❌ More complex to write

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

#### List Project Sections

```bash
node index.js sections <project_gid> [options]
```

Lists all sections in a project. Useful for finding section GIDs to move tasks into specific sections.

**Options:**
- `--format <list|table|json>` - Output format (default: list)
- `--fields <field1,field2>` - Fields to display (default: name,gid)

**Example:**

```bash
node index.js sections 1234567890
```

### Task-Project Management

#### Add Task to Project or Move to Section

```bash
node index.js add-to-project <task_gid> --project <project_gid> [--section <section_gid>]
```

Adds a task to a project. If the task is already in the project, moves it to the specified section.

**Options:**
- `--project <gid>` - Project GID (required)
- `--section <gid>` - Section GID within the project (optional)

**Examples:**

```bash
# Add task to a project
node index.js add-to-project 1234567890 --project 9876543210

# Move task to a specific section (if already in project)
node index.js add-to-project 1234567890 --project 9876543210 --section 1111111111
```

**Tip:** Use `sections <project_gid>` to list all sections and find the section GID.

#### Remove Task from Project

```bash
node index.js remove-from-project <task_gid> --project <project_gid>
```

Removes a task from a project.

**Example:**

```bash
node index.js remove-from-project 1234567890 --project 9876543210
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
