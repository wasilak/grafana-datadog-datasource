# Git Tools Usage

## Use Git MCP Tools Instead of CLI

This project has Git MCP tools available that should be used instead of direct git CLI commands for better integration and error handling.

### Available Git Tools

- ✅ `mcp_git_git_status` - Check working tree status
- ✅ `mcp_git_git_add` - Stage files for commit
- ✅ `mcp_git_git_commit` - Commit changes
- ✅ `mcp_git_git_diff_unstaged` - Show unstaged changes
- ✅ `mcp_git_git_diff_staged` - Show staged changes
- ✅ `mcp_git_git_log` - Show commit history
- ✅ `mcp_git_git_branch` - List or manage branches
- ✅ `mcp_git_git_checkout` - Switch branches
- ✅ `mcp_git_git_create_branch` - Create new branch
- ✅ `mcp_git_git_show` - Show commit contents
- ✅ `mcp_git_git_reset` - Unstage changes

### Usage Examples

Instead of CLI commands, use MCP tools:

```
❌ git status
✅ mcp_git_git_status

❌ git add .
✅ mcp_git_git_add with files parameter

❌ git commit -m "message"
✅ mcp_git_git_commit with message parameter

❌ git diff
✅ mcp_git_git_diff_unstaged

❌ git log --oneline -10
✅ mcp_git_git_log with max_count parameter
```

### Benefits

- **Better Integration**: Tools integrate with the development environment
- **Error Handling**: Structured error responses instead of raw CLI output
- **Type Safety**: Proper parameter validation and structured responses
- **Context Awareness**: Tools understand the current workspace context
- **Consistent Interface**: All git operations use the same tool interface

### When to Use

- Always prefer MCP git tools over CLI commands
- When checking repository status or history
- When staging and committing changes
- When working with branches
- When showing diffs or commit contents
- When suggesting git operations to users