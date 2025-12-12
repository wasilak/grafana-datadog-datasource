import { getTemplateSrv } from '@grafana/runtime';
import { ScopedVars } from '@grafana/data';
import { MyQuery, VariableFormat, VariableInterpolationContext } from '../types';

/**
 * Service for handling variable interpolation in queries and labels.
 * Supports single and multi-value variables with custom formatting options.
 */
export class VariableInterpolationService {
  private templateSrv = getTemplateSrv();

  /**
   * Interpolates variables in a query object.
   * @param query - The query object to interpolate
   * @param scopedVars - Scoped variables for interpolation
   * @returns The query with interpolated values
   */
  interpolateQuery(query: MyQuery, scopedVars: ScopedVars): MyQuery {
    try {
      // Determine the effective legend template based on mode
      const effectiveLegendTemplate = query.legendMode === 'custom' && query.legendTemplate 
        ? query.legendTemplate 
        : '';

      return {
        ...query,
        queryText: this.interpolateString(query.queryText || '', scopedVars),
        legendTemplate: query.legendMode === 'custom' 
          ? this.interpolateString(query.legendTemplate || '', scopedVars)
          : '',
        interpolatedQueryText: this.interpolateString(query.queryText || '', scopedVars),
        interpolatedLabel: this.interpolateString(effectiveLegendTemplate, scopedVars),
      };
    } catch (error) {
      console.error('Variable interpolation failed:', error);
      // Return original query as fallback
      return {
        ...query,
        interpolatedQueryText: query.queryText,
        interpolatedLabel: query.legendMode === 'custom' && query.legendTemplate 
          ? query.legendTemplate 
          : '',
      };
    }
  }

  /**
   * Interpolates variables in a label string.
   * @param label - The label string to interpolate
   * @param scopedVars - Scoped variables for interpolation
   * @returns The interpolated label string
   */
  interpolateLabel(label: string, scopedVars: ScopedVars): string {
    try {
      return this.interpolateString(label, scopedVars);
    } catch (error) {
      console.error('Label interpolation failed:', error);
      return label; // Fallback to original label
    }
  }

  /**
   * Interpolates variables in a string with custom formatting support.
   * @param text - The text to interpolate
   * @param scopedVars - Scoped variables for interpolation
   * @returns The interpolated string
   */
  private interpolateString(text: string, scopedVars: ScopedVars): string {
    if (!text) {
      return '';
    }

    try {
      // Handle custom format specifiers like ${variable:format}
      return text.replace(/\$\{([^}:]+):([^}]+)\}/g, (match, varName, format) => {
        const variable = scopedVars[varName] || this.templateSrv.getVariables().find(v => v.name === varName);
        
        if (!variable) {
          return match; // Return original if variable not found
        }

        const context = this.createInterpolationContext(variable, format as VariableFormat);
        return this.formatMultiValue(context.values, context.format || 'csv');
      }).replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
        // Handle simple variables like $variable
        return this.templateSrv.replace(match, scopedVars);
      });
    } catch (error) {
      console.error('String interpolation failed:', error);
      return text;
    }
  }

  /**
   * Creates an interpolation context from a variable.
   * @param variable - The variable object
   * @param format - The requested format
   * @returns The interpolation context
   */
  private createInterpolationContext(variable: any, format: VariableFormat): VariableInterpolationContext {
    let values: string[] = [];
    let isMultiValue = false;

    if (variable.current) {
      if (Array.isArray(variable.current.value)) {
        values = variable.current.value.map(String);
        isMultiValue = true;
      } else if (variable.current.value !== null && variable.current.value !== undefined) {
        values = [String(variable.current.value)];
        isMultiValue = false;
      }
    } else if (variable.value !== null && variable.value !== undefined) {
      if (Array.isArray(variable.value)) {
        values = variable.value.map(String);
        isMultiValue = true;
      } else {
        values = [String(variable.value)];
        isMultiValue = false;
      }
    }

    return {
      format,
      values,
      isMultiValue,
    };
  }

  /**
   * Formats multi-value variables according to the specified format.
   * @param values - Array of values to format
   * @param format - The format to apply
   * @returns The formatted string
   */
  formatMultiValue(values: string[], format: VariableFormat = 'csv'): string {
    // Handle empty or undefined values
    if (!values || values.length === 0) {
      return '';
    }

    // Filter out null, undefined, and empty string values
    const filteredValues = values.filter(value => 
      value !== null && 
      value !== undefined && 
      value !== ''
    );

    if (filteredValues.length === 0) {
      return '';
    }

    switch (format) {
      case 'csv':
        return filteredValues.join(',');
      
      case 'pipe':
        return filteredValues.join('|');
      
      case 'json':
        return JSON.stringify(filteredValues);
      
      case 'lucene':
        // Format for Lucene queries: (value1 OR value2 OR value3)
        return `(${filteredValues.map(v => `"${this.escapeLuceneValue(v)}"`).join(' OR ')})`;
      
      case 'raw':
        // Return the first value for raw format
        return filteredValues[0];
      
      default:
        // Default to CSV format
        return filteredValues.join(',');
    }
  }

  /**
   * Escapes special characters in Lucene query values.
   * @param value - The value to escape
   * @returns The escaped value
   */
  private escapeLuceneValue(value: string): string {
    // Escape special Lucene characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \
    return value.replace(/[+\-&|!(){}[\]^"~*?:\\]/g, '\\$&');
  }

  /**
   * Checks if a string contains variable placeholders.
   * @param text - The text to check
   * @returns True if the text contains variables
   */
  hasVariables(text: string): boolean {
    if (!text) {
      return false;
    }

    // Check for both ${variable:format} and $variable patterns
    return /\$\{[^}]+\}|\$[a-zA-Z_][a-zA-Z0-9_]*/.test(text);
  }

  /**
   * Extracts variable names from a text string.
   * @param text - The text to analyze
   * @returns Array of variable names found in the text
   */
  extractVariableNames(text: string): string[] {
    if (!text) {
      return [];
    }

    const variables: string[] = [];
    
    // Extract from ${variable:format} patterns
    const formatMatches = text.match(/\$\{([^}:]+):[^}]+\}/g);
    if (formatMatches) {
      formatMatches.forEach(match => {
        const varName = match.match(/\$\{([^}:]+):/)?.[1];
        if (varName && !variables.includes(varName)) {
          variables.push(varName);
        }
      });
    }

    // Extract from $variable patterns
    const simpleMatches = text.match(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (simpleMatches) {
      simpleMatches.forEach(match => {
        const varName = match.substring(1); // Remove the $
        if (!variables.includes(varName)) {
          variables.push(varName);
        }
      });
    }

    return variables;
  }
}

// Export a singleton instance for use throughout the application
export const variableInterpolationService = new VariableInterpolationService();