# Command Line Tools

## Use Modern CLI Tools

This project has modern command-line tools available in PATH that should be used instead of traditional Unix tools for better performance and features.

### File Search

- ✅ `fd` - Use fd for file searching
- ❌ `find` - Don't use find

**Why fd**: Faster, respects .gitignore by default, simpler syntax, colored output

**Examples**:
```bash
# Find TypeScript files
fd -e ts

# Find files matching pattern
fd "autocomplete"

# Find in specific directory
fd -e ts . src/
```

### Text Search

- ✅ `rg` (ripgrep) - Use ripgrep for text searching
- ❌ `grep` - Don't use grep

**Why ripgrep**: Much faster, respects .gitignore by default, better regex support, colored output

**Examples**:
```bash
# Search for text
rg "useQueryAutocomplete"

# Search in specific file types
rg -t ts "interface"

# Search with context lines
rg -C 3 "onKeyDown"

# Case insensitive search
rg -i "error"
```

### When to Use

- Always prefer `fd` over `find` for file searching
- Always prefer `rg` over `grep` for text searching
- When suggesting commands to users, use `fd` and `rg` syntax
- When writing documentation, reference `fd` and `rg` commands
- When creating build scripts or automation, use `fd` and `rg`

### Benefits

- **Performance**: Both tools are significantly faster than their traditional counterparts
- **Smart defaults**: Automatically respect .gitignore and skip hidden files
- **Better UX**: Colored output, simpler syntax, more intuitive options
- **Modern features**: Better regex support, parallel execution, smart case sensitivity
