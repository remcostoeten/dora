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
        
        if (typeInfo.hasSingleNonExportedType) {
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
  // Find all type/interface definitions
  const typeRegex = /^(export\s+)?(type|interface)\s+(\w+)/gm;
  const matches = [...content.matchAll(typeRegex)];
  
  if (matches.length === 0) return { hasSingleNonExportedType: false };
  
  // Filter for non-exported types
  const nonExportedTypes = matches.filter(match => !match[1]); // match[1] is the 'export ' part
  
  if (nonExportedTypes.length === 1) {
    const match = nonExportedTypes[0];
    return {
      hasSingleNonExportedType: true,
      typeName: match[3],
      typeKind: match[2] // 'type' or 'interface'
    };
  }
  
  return { hasSingleNonExportedType: false };
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
  
  console.log(`Found ${filesToUpdate.length} files with single non-exported types:`);
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
    console.log('No files with single non-exported types found.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { findFilesWithSingleNonExportedType, analyzeFile, renameTypeToProps };
