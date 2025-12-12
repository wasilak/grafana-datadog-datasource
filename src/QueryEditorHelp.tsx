import React from 'react';
import { Button, Card, Stack, useTheme2 } from '@grafana/ui';
import { DataQuery } from '@grafana/data';
import { MyQuery, VariableExample } from './types';

interface QueryEditorHelpProps {
  onClickExample: (query: DataQuery) => void;
}

// Variable examples organized by category
const VARIABLE_EXAMPLES: VariableExample[] = [
  // Basic variable usage
  {
    title: 'Basic Variable',
    expression: 'avg:system.cpu.user{host:$hostname}',
    label: 'CPU Usage for $hostname',
    category: 'basic',
    description: 'Use $variableName to insert a single variable value'
  },
  {
    title: 'Built-in Time Variables',
    expression: 'avg:system.load.1{*} by {host}',
    label: 'Load Average from $__from to $__to',
    category: 'basic',
    description: 'Use $__from and $__to for dashboard time range'
  },
  {
    title: 'Multiple Variables',
    expression: 'avg:$metric{service:$service,env:$environment}',
    label: '$metric for $service in $environment',
    category: 'basic',
    description: 'Combine multiple variables in a single query'
  },

  // Multi-value variable formatting
  {
    title: 'Multi-value CSV',
    expression: 'avg:system.cpu.user{host:${hostname:csv}}',
    label: 'CPU for hosts: ${hostname:csv}',
    category: 'multi-value',
    description: 'Format multi-value variables as comma-separated values'
  },
  {
    title: 'Multi-value Pipe',
    expression: 'avg:system.cpu.user{host:${hostname:pipe}}',
    label: 'CPU for hosts: ${hostname:pipe}',
    category: 'multi-value',
    description: 'Format multi-value variables with pipe separators'
  },
  {
    title: 'Multi-value JSON',
    expression: 'avg:system.cpu.user{host:${hostname:json}}',
    label: 'CPU for hosts: ${hostname:json}',
    category: 'multi-value',
    description: 'Format multi-value variables as JSON array'
  },

  // Advanced formatting
  {
    title: 'Tag Filter Syntax',
    expression: 'avg:system.cpu.user{service:$service,env:$environment} by {host}',
    label: 'CPU by Host for $service',
    category: 'formatting',
    description: 'Use variables in Datadog tag filter syntax'
  },
  {
    title: 'Metric Name Variable',
    expression: '$metric{service:$service} by {host}',
    label: '$metric by Host',
    category: 'formatting',
    description: 'Use variables for metric names and aggregations'
  },
  {
    title: 'Complex Query',
    expression: '${aggregation:raw}:$metric{${tags:pipe}} by {${groupby:csv}}',
    label: '${aggregation:raw} of $metric',
    category: 'formatting',
    description: 'Combine multiple variable formats in complex queries'
  }
];

export function QueryEditorHelp({ onClickExample }: QueryEditorHelpProps) {
  const theme = useTheme2();

  const handleExampleClick = (example: VariableExample) => {
    const query: MyQuery = {
      refId: 'A',
      queryText: example.expression,
      legendMode: 'custom',
      legendTemplate: example.label
    };
    onClickExample(query);
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'basic':
        return 'Basic Variable Usage';
      case 'multi-value':
        return 'Multi-value Variables';
      case 'formatting':
        return 'Advanced Formatting';
      default:
        return 'Examples';
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'basic':
        return 'Simple variable substitution patterns';
      case 'multi-value':
        return 'Format variables with multiple selected values';
      case 'formatting':
        return 'Advanced patterns for complex queries';
      default:
        return '';
    }
  };

  // Group examples by category
  const groupedExamples = VARIABLE_EXAMPLES.reduce((groups, example) => {
    const category = example.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(example);
    return groups;
  }, {} as Record<string, VariableExample[]>);

  return (
    <Card>
      <Card.Heading>Variable Usage Examples</Card.Heading>
      <Card.Description>
        Click any example to insert it into your query. Variables are replaced with actual values when the query runs.
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
                        
                        <div style={{ marginBottom: theme.spacing(1) }}>
                          <strong style={{ 
                            fontSize: theme.typography.bodySmall.fontSize,
                            color: theme.colors.text.secondary 
                          }}>
                            Label: 
                          </strong>
                          <span style={{ 
                            fontSize: theme.typography.bodySmall.fontSize,
                            color: theme.colors.text.primary,
                            marginLeft: theme.spacing(0.5)
                          }}>
                            {example.label}
                          </span>
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

        {/* Additional help text */}
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
            Variable Format Options
          </h4>
          
          <Stack direction="column" gap={1}>
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                $variable
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Simple variable substitution
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                $&#123;variable:csv&#125;
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Comma-separated values (value1,value2,value3)
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                $&#123;variable:pipe&#125;
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Pipe-separated values (value1|value2|value3)
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                $&#123;variable:json&#125;
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - JSON array format (["value1","value2","value3"])
              </span>
            </div>
            
            <div>
              <code style={{ 
                fontFamily: theme.typography.fontFamilyMonospace,
                color: theme.colors.primary.text 
              }}>
                $&#123;variable:raw&#125;
              </code>
              <span style={{ 
                marginLeft: theme.spacing(1),
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.secondary
              }}>
                - Raw value without formatting
              </span>
            </div>
          </Stack>
        </div>
      </div>
    </Card>
  );
}