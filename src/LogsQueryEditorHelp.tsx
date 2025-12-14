import React from 'react';
import { Button, Card, Stack, useTheme2 } from '@grafana/ui';
import { DataQuery } from '@grafana/data';
import { MyQuery } from './types';

interface LogsQueryEditorHelpProps {
  onClickExample: (query: DataQuery) => void;
}

interface LogsExample {
  title: string;
  expression: string;
  category: 'basic' | 'filtering' | 'boolean' | 'advanced';
  description: string;
}

// Logs search examples organized by category
const LOGS_EXAMPLES: LogsExample[] = [
  // Basic search
  {
    title: 'Text Search',
    expression: 'error',
    category: 'basic',
    description: 'Search for logs containing the word "error"'
  },
  {
    title: 'Phrase Search',
    expression: '"connection timeout"',
    category: 'basic',
    description: 'Search for exact phrase in quotes'
  },
  {
    title: 'Wildcard Search',
    expression: 'error*',
    category: 'basic',
    description: 'Search with wildcard patterns (error, errors, errorCode, etc.)'
  },

  // Filtering by facets
  {
    title: 'Service Filter',
    expression: 'service:web-app',
    category: 'filtering',
    description: 'Filter logs by service name'
  },
  {
    title: 'Log Level Filter',
    expression: 'status:ERROR',
    category: 'filtering',
    description: 'Filter by log level (DEBUG, INFO, WARN, ERROR, FATAL)'
  },
  {
    title: 'Source Filter',
    expression: 'source:nginx',
    category: 'filtering',
    description: 'Filter logs by source (nginx, apache, application, etc.)'
  },
  {
    title: 'Host Filter',
    expression: 'host:web-server-01',
    category: 'filtering',
    description: 'Filter logs by hostname'
  },
  {
    title: 'Environment Filter',
    expression: 'env:production',
    category: 'filtering',
    description: 'Filter logs by environment'
  },

  // Boolean operators
  {
    title: 'AND Operator',
    expression: 'service:web-app AND status:ERROR',
    category: 'boolean',
    description: 'Combine conditions with AND (both must be true)'
  },
  {
    title: 'OR Operator',
    expression: 'status:ERROR OR status:WARN',
    category: 'boolean',
    description: 'Use OR for alternative conditions'
  },
  {
    title: 'NOT Operator',
    expression: 'service:web-app NOT status:DEBUG',
    category: 'boolean',
    description: 'Exclude logs matching condition with NOT'
  },
  {
    title: 'Grouped Conditions',
    expression: 'service:web-app AND (status:ERROR OR status:WARN)',
    category: 'boolean',
    description: 'Use parentheses to group conditions'
  },

  // Advanced patterns
  {
    title: 'Multiple Services',
    expression: 'service:(web-app OR api-service)',
    category: 'advanced',
    description: 'Filter by multiple services using parentheses'
  },
  {
    title: 'Range Query',
    expression: 'response_time:>500',
    category: 'advanced',
    description: 'Numeric range queries (>, <, >=, <=)'
  },
  {
    title: 'Complex Query',
    expression: 'service:web-app status:(ERROR OR WARN) NOT source:health-check',
    category: 'advanced',
    description: 'Complex query combining multiple operators and facets'
  },
  {
    title: 'Variable Usage',
    expression: 'service:$service status:$log_level',
    category: 'advanced',
    description: 'Use Grafana variables in logs queries'
  }
];

export function LogsQueryEditorHelp({ onClickExample }: LogsQueryEditorHelpProps) {
  const theme = useTheme2();

  const handleExampleClick = (example: LogsExample) => {
    const query: MyQuery = {
      refId: 'A',
      logQuery: example.expression,
      queryType: 'logs'
    };
    onClickExample(query);
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'basic':
        return 'Basic Search';
      case 'filtering':
        return 'Facet Filtering';
      case 'boolean':
        return 'Boolean Operators';
      case 'advanced':
        return 'Advanced Patterns';
      default:
        return 'Examples';
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'basic':
        return 'Simple text and wildcard searches';
      case 'filtering':
        return 'Filter logs by service, level, source, and other facets';
      case 'boolean':
        return 'Combine conditions with AND, OR, and NOT operators';
      case 'advanced':
        return 'Complex queries with multiple conditions and variables';
      default:
        return '';
    }
  };

  // Group examples by category
  const groupedExamples = LOGS_EXAMPLES.reduce((groups, example) => {
    const category = example.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(example);
    return groups;
  }, {} as Record<string, LogsExample[]>);

  return (
    <Card>
      <Card.Heading>Datadog Logs Search Syntax</Card.Heading>
      <Card.Description>
        Click any example to insert it into your logs query. Use Datadog's search syntax to filter and find logs.
      </Card.Description>
      
      <div style={{ padding: theme.spacing(2) }}>
        <Stack direction="column" gap={3}>
          {Object.entries(groupedExamples).map(([category, examples]) => (
            <div key={category}>
              <h4 style={{ 
                margin: `0 0 ${theme.spacing(1)} 0`,
                color: theme.colors.text.primary,
                fontSize: theme.typography.h5.fontSize,
                fontWeight: theme.typography.fontWeightMedium
              }}>
                {getCategoryTitle(category)}
              </h4>
              
              <p style={{ 
                margin: `0 0 ${theme.spacing(2)} 0`,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.bodySmall.fontSize
              }}>
                {getCategoryDescription(category)}
              </p>

              <Stack direction="column" gap={1}>
                {examples.map((example, index) => (
                  <div
                    key={`${category}-${index}`}
                    style={{
                      border: `1px solid ${theme.colors.border.weak}`,
                      borderRadius: theme.shape.radius.default,
                      padding: theme.spacing(2),
                      backgroundColor: theme.colors.background.secondary
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <div style={{ flex: 1, marginRight: theme.spacing(2) }}>
                        <h5 style={{ 
                          margin: `0 0 ${theme.spacing(0.5)} 0`,
                          color: theme.colors.text.primary,
                          fontSize: theme.typography.bodySmall.fontSize,
                          fontWeight: theme.typography.fontWeightMedium
                        }}>
                          {example.title}
                        </h5>
                        
                        <div style={{ marginBottom: theme.spacing(1) }}>
                          <code style={{
                            backgroundColor: theme.colors.background.primary,
                            border: `1px solid ${theme.colors.border.weak}`,
                            borderRadius: theme.shape.radius.default,
                            padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
                            fontSize: theme.typography.bodySmall.fontSize,
                            fontFamily: theme.typography.fontFamilyMonospace,
                            color: theme.colors.text.primary,
                            display: 'block',
                            wordBreak: 'break-all'
                          }}>
                            {example.expression}
                          </code>
                        </div>
                        
                        <p style={{ 
                          margin: 0,
                          fontSize: theme.typography.bodySmall.fontSize,
                          color: theme.colors.text.secondary,
                          fontStyle: 'italic'
                        }}>
                          {example.description}
                        </p>
                      </div>
                      
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleExampleClick(example)}
                        style={{ flexShrink: 0 }}
                      >
                        Use Example
                      </Button>
                    </Stack>
                  </div>
                ))}
              </Stack>
            </div>
          ))}
        </Stack>

        {/* Additional syntax reference */}
        <div style={{ 
          marginTop: theme.spacing(3),
          padding: theme.spacing(2),
          backgroundColor: theme.colors.background.secondary,
          border: `1px solid ${theme.colors.border.weak}`,
          borderRadius: theme.shape.radius.default
        }}>
          <h4 style={{ 
            margin: `0 0 ${theme.spacing(1)} 0`,
            color: theme.colors.text.primary,
            fontSize: theme.typography.h5.fontSize,
            fontWeight: theme.typography.fontWeightMedium
          }}>
            Common Facets
          </h4>
          
          <Stack direction="column" gap={1}>
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                service:
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Service name (web-app, api-service, worker)
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                status:
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Log level (DEBUG, INFO, WARN, ERROR, FATAL)
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                source:
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Log source (nginx, apache, application)
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                host:
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Hostname or server identifier
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                env:
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Environment (production, staging, development)
              </span>
            </div>
          </Stack>
        </div>

        {/* Operators reference */}
        <div style={{ 
          marginTop: theme.spacing(2),
          padding: theme.spacing(2),
          backgroundColor: theme.colors.background.secondary,
          border: `1px solid ${theme.colors.border.weak}`,
          borderRadius: theme.shape.radius.default
        }}>
          <h4 style={{ 
            margin: `0 0 ${theme.spacing(1)} 0`,
            color: theme.colors.text.primary,
            fontSize: theme.typography.h5.fontSize,
            fontWeight: theme.typography.fontWeightMedium
          }}>
            Operators & Wildcards
          </h4>
          
          <Stack direction="column" gap={1}>
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                AND
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Both conditions must be true
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                OR
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Either condition can be true
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                NOT
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Exclude matching logs
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                *
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Wildcard (matches any characters)
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                "phrase"
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Exact phrase search
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                ( )
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Group conditions for precedence
              </span>
            </div>
          </Stack>
        </div>
      </div>
    </Card>
  );
}