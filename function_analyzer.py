#!/usr/bin/env python3
"""
Function Analyzer for Gmail Support System
Checks for undefined function calls and missing references
"""

import os
import re
from pathlib import Path
import json

def extract_function_definitions(content):
    """Extract all function definitions from JavaScript/GAS code"""
    functions = set()
    
    # Regular function declarations
    pattern1 = r'function\s+(\w+)\s*\('
    functions.update(re.findall(pattern1, content))
    
    # Class methods
    pattern2 = r'(?:static\s+)?(\w+)\s*\([^)]*\)\s*{'
    functions.update(re.findall(pattern2, content))
    
    # Arrow functions assigned to variables
    pattern3 = r'(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]+)\s*=>'
    functions.update(re.findall(pattern3, content))
    
    # Object methods
    pattern4 = r'(\w+)\s*:\s*function\s*\('
    functions.update(re.findall(pattern4, content))
    
    return functions

def extract_function_calls(content):
    """Extract all function calls from JavaScript/GAS code"""
    calls = []
    
    # Function calls
    pattern = r'(\w+)\s*\('
    for match in re.finditer(pattern, content):
        func_name = match.group(1)
        # Exclude JavaScript keywords and common built-ins
        if func_name not in ['if', 'for', 'while', 'switch', 'catch', 'function', 
                             'return', 'throw', 'new', 'typeof', 'instanceof',
                             'console', 'Array', 'Object', 'String', 'Number',
                             'Date', 'Math', 'JSON', 'parseInt', 'parseFloat']:
            calls.append({
                'name': func_name,
                'line': content[:match.start()].count('\n') + 1
            })
    
    return calls

def extract_class_references(content):
    """Extract class instantiations and static calls"""
    references = []
    
    # new ClassName()
    pattern1 = r'new\s+(\w+)\s*\('
    for match in re.finditer(pattern1, content):
        references.append({
            'type': 'instantiation',
            'name': match.group(1),
            'line': content[:match.start()].count('\n') + 1
        })
    
    # ClassName.method() or ClassName.property
    pattern2 = r'(\w+)\.(\w+)'
    for match in re.finditer(pattern2, content):
        class_name = match.group(1)
        if class_name[0].isupper():  # Likely a class name
            references.append({
                'type': 'static_reference',
                'name': class_name,
                'member': match.group(2),
                'line': content[:match.start()].count('\n') + 1
            })
    
    return references

def analyze_file(filepath):
    """Analyze a single file for function definitions and calls"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove comments to avoid false positives
    content = re.sub(r'//.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)
    
    definitions = extract_function_definitions(content)
    calls = extract_function_calls(content)
    class_refs = extract_class_references(content)
    
    return {
        'definitions': definitions,
        'calls': calls,
        'class_references': class_refs
    }

def main():
    """Main function to analyze all .gs files"""
    print("=== Gmail Support System Function Analyzer ===\n")
    
    project_root = Path('.')
    gs_files = list(project_root.glob('*.gs'))
    
    # Collect all definitions and calls
    all_definitions = set()
    all_calls = {}
    all_class_refs = {}
    file_definitions = {}
    
    # Google Apps Script built-in services
    gas_builtins = {
        'SpreadsheetApp', 'GmailApp', 'DriveApp', 'PropertiesService',
        'CacheService', 'UrlFetchApp', 'Utilities', 'ScriptApp',
        'CalendarApp', 'DocumentApp', 'FormApp', 'GroupsApp',
        'HtmlService', 'LanguageApp', 'LockService', 'MailApp',
        'Session', 'SitesApp', 'SlidesApp', 'Logger', 'console'
    }
    
    # First pass: collect all definitions
    for filepath in gs_files:
        analysis = analyze_file(filepath)
        file_definitions[str(filepath)] = analysis['definitions']
        all_definitions.update(analysis['definitions'])
        
        # Track calls
        for call in analysis['calls']:
            if call['name'] not in all_calls:
                all_calls[call['name']] = []
            all_calls[call['name']].append({
                'file': str(filepath),
                'line': call['line']
            })
        
        # Track class references
        for ref in analysis['class_references']:
            if ref['name'] not in all_class_refs:
                all_class_refs[ref['name']] = []
            all_class_refs[ref['name']].append({
                'file': str(filepath),
                'line': ref['line'],
                'type': ref['type'],
                'member': ref.get('member', '')
            })
    
    # Find undefined functions
    undefined_functions = {}
    for func_name, locations in all_calls.items():
        if func_name not in all_definitions and func_name not in gas_builtins:
            # Check if it's a method of a known class
            is_method = False
            for class_name in all_definitions:
                if func_name.startswith(class_name):
                    is_method = True
                    break
            
            if not is_method:
                undefined_functions[func_name] = locations
    
    # Find undefined classes
    undefined_classes = {}
    for class_name, locations in all_class_refs.items():
        if class_name not in all_definitions and class_name not in gas_builtins:
            undefined_classes[class_name] = locations
    
    # Report results
    print(f"Analyzed {len(gs_files)} files\n")
    print(f"Found {len(all_definitions)} function/class definitions")
    print(f"Found {len(all_calls)} unique function calls")
    print(f"Found {len(all_class_refs)} class references\n")
    
    if undefined_functions:
        print(f"⚠️  Found {len(undefined_functions)} undefined functions:\n")
        for func_name, locations in sorted(undefined_functions.items()):
            print(f"  {func_name}:")
            for loc in locations[:3]:  # Show first 3 occurrences
                print(f"    - {loc['file']}:{loc['line']}")
            if len(locations) > 3:
                print(f"    ... and {len(locations) - 3} more")
    else:
        print("✅ All function calls are defined!\n")
    
    if undefined_classes:
        print(f"\n⚠️  Found {len(undefined_classes)} undefined classes:\n")
        for class_name, locations in sorted(undefined_classes.items()):
            print(f"  {class_name}:")
            for loc in locations[:3]:
                print(f"    - {loc['file']}:{loc['line']} ({loc['type']})")
            if len(locations) > 3:
                print(f"    ... and {len(locations) - 3} more")
    else:
        print("✅ All class references are defined!\n")
    
    # Save detailed report
    report = {
        'summary': {
            'files_analyzed': len(gs_files),
            'total_definitions': len(all_definitions),
            'total_calls': len(all_calls),
            'undefined_functions': len(undefined_functions),
            'undefined_classes': len(undefined_classes)
        },
        'undefined_functions': undefined_functions,
        'undefined_classes': undefined_classes,
        'all_definitions': list(all_definitions)
    }
    
    with open('function_analysis_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print("\nDetailed report saved to function_analysis_report.json")
    
    # Return exit code based on findings
    return len(undefined_functions) + len(undefined_classes)

if __name__ == '__main__':
    exit(main())