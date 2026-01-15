export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce consistent prop type naming conventions",
      category: "Stylistic Issues",
      recommended: true,
    },
    fixable: "code",
    schema: [],
    messages: {
      usePropsName: "Type should be named 'Props' when it's the only non-exported type",
      useTypeInsteadOfInterface: "Use 'type' instead of 'interface' for prop types",
    },
  },

  create(context) {
    function isPropType(node) {
      // Check if this looks like a prop type (used in React component parameters)
      const parent = node.parent;
      if (!parent) return false;
      
      // Check if it's used as a parameter type annotation
      if (parent.type === 'TSTypeAnnotation') {
        const funcParam = parent.parent;
        if (funcParam && funcParam.type === 'FunctionDeclaration') {
          return true;
        }
      }
      
      // Check if the name suggests it's a prop type
      if (node.id && (
        node.id.name.endsWith('Props') ||
        node.id.name.endsWith('props') ||
        node.id.name.includes('Prop')
      )) {
        return true;
      }
      
      return false;
    }

    function getExportedTypes(node) {
      const exportedTypes = [];
      const nonExportedTypes = [];
      
      // Find all type/interface declarations in the same scope
      const body = node.parent && node.parent.type === 'Program' ? node.parent.body : [];
      
      for (const statement of body) {
        if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
          if (statement.declaration.type === 'TSInterfaceDeclaration' || 
              statement.declaration.type === 'TSTypeAliasDeclaration') {
            exportedTypes.push(statement.declaration);
          }
        } else if (statement.type === 'TSInterfaceDeclaration' || 
                   statement.type === 'TSTypeAliasDeclaration') {
          nonExportedTypes.push(statement);
        }
      }
      
      return { exportedTypes, nonExportedTypes };
    }

    return {
      TSInterfaceDeclaration(node) {
        if (!isPropType(node)) return;
        
        // Rule: Use 'type' instead of 'interface'
        context.report({
          node: node.id,
          messageId: "useTypeInsteadOfInterface",
          fix: (fixer) => {
            const sourceCode = context.getSourceCode();
            const text = sourceCode.getText(node);
            
            // Convert interface to type
            const typeText = text
              .replace('interface ', 'type ')
              .replace(/extends\s+[^{]+/, '') // Remove extends clause for simplicity
              .replace('{', '= {');
            
            return fixer.replaceText(node, typeText);
          },
        });
      },

      TSTypeAliasDeclaration(node) {
        if (!isPropType(node)) return;
        
        const { exportedTypes, nonExportedTypes } = getExportedTypes(node);
        
        // Rule: If there's only 1 non-exported type, it should be named 'Props'
        if (nonExportedTypes.length === 1 && exportedTypes.length === 0) {
          if (node.id.name !== 'Props') {
            context.report({
              node: node.id,
              messageId: "usePropsName",
              fix: (fixer) => {
                return fixer.replaceText(node.id, 'Props');
              },
            });
          }
        }
        
        // Rule: If there's 1 exported and 1 non-exported, the non-exported can be 'props'
        if (nonExportedTypes.length === 1 && exportedTypes.length === 1) {
          const nonExportedType = nonExportedTypes[0];
          if (nonExportedType === node && nonExportedType.id.name !== 'props') {
            context.report({
              node: node.id,
              messageId: "usePropsName",
              fix: (fixer) => {
                return fixer.replaceText(node.id, 'props');
              },
            });
          }
        }
      },
    };
  },
};
