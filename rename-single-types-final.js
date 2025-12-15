#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findFilesWithSingleNonExportedType(dir) {
  const files = [];
  
  function walkDir(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walkDir(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const typeInfo = analyzeFile(content);
        
        if (typeInfo.hasExactlyOneNonExportedType) {
          files.push({
            path: fullPath,
            typeName: typeInfo.typeName,
            typeKind: typeInfo.typeKind
          });
        }
      }
    }
  }
  
  walkDir(dir);
  return files;
}

function analyzeFile(content) {
  // Find all type/interface definitions line by line
  const lines = content.split('\n');
  const allTypes = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Match type/interface definitions at start of line (after optional whitespace)
    const match = trimmed.match(/^(export\s+)?(type|interface)\s+(\w+)/);
    if (match) {
      allTypes.push({
        isExported: !!match[1],
        typeKind: match[2],
        typeName: match[3],
        line: line
      });
    }
  }
  
  // Only proceed if there's exactly one type total and it's not exported
  if (allTypes.length === 1 && !allTypes[0].isExported) {
    const type = allTypes[0];
    return {
      hasExactlyOneNonExportedType: true,
      typeName: type.typeName,
      typeKind: type.typeKind
    };
  }
  
  return { hasExactlyOneNonExportedType: false };
}

function renameTypeToProps(filePath, currentTypeName, typeKind) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the type definition (only at start of line after optional whitespace)
  const typeRegex = new RegExp(`^\\s*(type|interface)\\s+${currentTypeName}\\b`, 'gm');
  const updatedContent = content.replace(typeRegex, (match, p1) => {
    return match.replace(p1, typeKind).replace(currentTypeName, 'Props');
  });
  
  // Replace all usages of the type (word boundaries to avoid partial matches)
  const usageRegex = new RegExp(`\\b${currentTypeName}\\b`, 'g');
  const finalContent = updatedContent.replace(usageRegex, 'Props');
  
  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log(`Updated ${filePath}: renamed ${currentTypeName} to Props`);
}

function main() {
  const srcDir = path.join(__dirname, 'src');
  const filesToUpdate = findFilesWithSingleNonExportedType(srcDir);
  
  console.log(`Found ${filesToUpdate.length} files with exactly one non-exported type:`);
  filesToUpdate.forEach(file => {
    console.log(`  ${file.path}: ${file.typeKind} ${file.typeName}`);
  });
  
  if (filesToUpdate.length > 0) {
    console.log('\nRenaming types to "Props"...');
    filesToUpdate.forEach(file => {
      renameTypeToProps(file.path, file.typeName, file.typeKind);
    });
    console.log('\nDone!');
  } else {
    console.log('No files with exactly one non-exported type found.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { findFilesWithSingleNonExportedType, analyzeFile, renameTypeToProps };
