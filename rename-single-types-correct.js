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
  // Find all type/interface definitions (exported and non-exported)
  const typeRegex = /^(export\s+)?(type|interface)\s+(\w+)/gm;
  const matches = [...content.matchAll(typeRegex)];
  
  if (matches.length === 0) return { hasExactlyOneNonExportedType: false };
  
  // Count total types and separate exported from non-exported
  const exportedTypes = matches.filter(match => match[1]); // has 'export '
  const nonExportedTypes = matches.filter(match => !match[1]); // no 'export '
  
  // Only proceed if there's exactly one non-exported type AND no other types at all
  if (nonExportedTypes.length === 1 && exportedTypes.length === 0 && matches.length === 1) {
    const match = nonExportedTypes[0];
    return {
      hasExactlyOneNonExportedType: true,
      typeName: match[3],
      typeKind: match[2] // 'type' or 'interface'
    };
  }
  
  return { hasExactlyOneNonExportedType: false };
}

function renameTypeToProps(filePath, currentTypeName, typeKind) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the type definition
  const typeRegex = new RegExp(`^(type|interface)\\s+${currentTypeName}\\b`, 'gm');
  const updatedContent = content.replace(typeRegex, `${typeKind} Props`);
  
  // Replace all usages of the type
  const usageRegex = new RegExp(`\\b${currentTypeName}\\b`, 'g');
  const finalContent = updatedContent.replace(usageRegex, 'Props');
  
  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log(`Updated ${filePath}: renamed ${currentTypeName} to Props`);
}

function main() {
  const srcDir = path.join(__dirname, 'src');
  const filesToUpdate = findFilesWithSingleNonExportedType(srcDir);
  
  console.log(`Found ${filesToUpdate.length} files with exactly one non-exported type and no other types:`);
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
