import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('=== RUNNING WP-15B-FIX-16 TAINT-AWARE LOCALE/JURISDICTION REGRESSION TESTS ===\n');

let passedAssertions = 0;
let totalAssertions = 0;

function runAssertion(name, fn) {
  totalAssertions++;
  try {
    fn();
    passedAssertions++;
    console.log(`[PASS] Assertion ${totalAssertions}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Assertion ${totalAssertions}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function readFile(relPath) {
  const fullPath = path.join(projectRoot, relPath);
  return fs.readFileSync(fullPath, 'utf8');
}

// -----------------------------------------------------------------------------
// Load Guide Articles via TypeScript In-Memory Transpilation
// -----------------------------------------------------------------------------
function loadAllGuideArticles() {
  const clusterFiles = [
    'src/data/guides/cluster-platform.ts',
    'src/data/guides/cluster-a-associations.ts',
    'src/data/guides/cluster-b-operations.ts',
    'src/data/guides/cluster-c-property-managers.ts',
  ];

  const articles = {};
  for (const relFile of clusterFiles) {
    const fullPath = path.join(projectRoot, relFile);
    const source = fs.readFileSync(fullPath, 'utf8');
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;

    const context = { exports: {} };
    vm.createContext(context);
    vm.runInContext(js, context);
    const exportedRecord = Object.values(context.exports)[0];
    Object.assign(articles, exportedRecord);
  }
  return articles;
}

const publishedArticles = loadAllGuideArticles();

// -----------------------------------------------------------------------------
// Assertion 1: Mandatory contentApplicability on all 14 published articles
// -----------------------------------------------------------------------------
runAssertion('All 14 published guide articles have mandatory contentApplicability with correct scopes', () => {
  const articleList = Object.values(publishedArticles);
  assert.equal(articleList.length, 14, `Expected exactly 14 published articles, got ${articleList.length}`);

  const roArticles = articleList.filter((a) => a.lang === 'ro');
  const enArticles = articleList.filter((a) => a.lang === 'en');
  const faArticles = articleList.filter((a) => a.lang === 'fa');

  assert.equal(roArticles.length, 11, 'Expected 11 Romanian articles');
  assert.equal(enArticles.length, 2, 'Expected 2 English articles');
  assert.equal(faArticles.length, 1, 'Expected 1 Persian article');

  // Verify all 11 Romanian articles have { kind: 'country', countryCode: 'RO' }
  for (const art of roArticles) {
    assert.ok(art.contentApplicability, `Article ${art.slug} missing contentApplicability`);
    assert.equal(art.contentApplicability.kind, 'country', `RO article ${art.slug} must have kind 'country'`);
    assert.equal(art.contentApplicability.countryCode, 'RO', `RO article ${art.slug} must have countryCode 'RO'`);
    assert.equal(art.jurisdiction, undefined, `RO article ${art.slug} must not have legacy jurisdiction field`);
  }

  // Verify 2 English articles have { kind: 'global' }
  for (const art of enArticles) {
    assert.ok(art.contentApplicability, `Article ${art.slug} missing contentApplicability`);
    assert.equal(art.contentApplicability.kind, 'global', `EN article ${art.slug} must have kind 'global'`);
    assert.equal(art.contentApplicability.countryCode, undefined, `Global article ${art.slug} must not define countryCode`);
    assert.equal(art.jurisdiction, undefined, `EN article ${art.slug} must not have legacy jurisdiction field`);
  }

  // Verify 1 Persian article has { kind: 'global' }
  for (const art of faArticles) {
    assert.ok(art.contentApplicability, `Article ${art.slug} missing contentApplicability`);
    assert.equal(art.contentApplicability.kind, 'global', `FA article ${art.slug} must have kind 'global'`);
    assert.equal(art.contentApplicability.countryCode, undefined, `Global article ${art.slug} must not define countryCode`);
    assert.equal(art.jurisdiction, undefined, `FA article ${art.slug} must not have legacy jurisdiction field`);
  }
});

// -----------------------------------------------------------------------------
// Assertion 2: Closed discriminated union GuideContentApplicability, no `| string`
// -----------------------------------------------------------------------------
runAssertion('GuideContentApplicability is a closed discriminated union with no | string fallback', () => {
  const typesContent = readFile('src/data/guides/types.ts');

  // Must not have `| string` in jurisdiction or country code
  assert.ok(!typesContent.includes("export type GuideJurisdiction = 'RO' | 'GLOBAL' | 'CROSS_BORDER' | string;"),
    'Legacy GuideJurisdiction with | string must be removed');
  assert.ok(!typesContent.includes('| string;'), 'types.ts must not contain open | string union for applicability');

  // Must declare GuideCountryCode = 'RO'
  assert.ok(typesContent.includes("export type GuideCountryCode = 'RO';"),
    "types.ts must define closed GuideCountryCode = 'RO'");

  // Must define GuideContentApplicability with kind: 'global' | 'cross_border' | 'country'
  assert.ok(typesContent.includes("export type GuideContentApplicability ="),
    'types.ts must export GuideContentApplicability');
  assert.ok(typesContent.includes("{ kind: 'global' }"), "Must support { kind: 'global' }");
  assert.ok(typesContent.includes("{ kind: 'cross_border' }"), "Must support { kind: 'cross_border' }");
  assert.ok(typesContent.includes("{ kind: 'country'; countryCode: GuideCountryCode }"),
    "Must support { kind: 'country'; countryCode: GuideCountryCode }");

  // Validate rejection of arbitrary values and locale codes
  const allowedCountryCodes = new Set(['RO']);
  function validateApplicability(input) {
    if (!input || typeof input !== 'object') return false;
    if (input.kind === 'global' || input.kind === 'cross_border') {
      return input.countryCode === undefined;
    }
    if (input.kind === 'country') {
      return typeof input.countryCode === 'string' && allowedCountryCodes.has(input.countryCode);
    }
    return false;
  }

  // Permitted
  assert.equal(validateApplicability({ kind: 'global' }), true);
  assert.equal(validateApplicability({ kind: 'cross_border' }), true);
  assert.equal(validateApplicability({ kind: 'country', countryCode: 'RO' }), true);

  // Rejected arbitrary country codes and string values
  assert.equal(validateApplicability('RO'), false);
  assert.equal(validateApplicability('GLOBAL'), false);
  assert.equal(validateApplicability({ kind: 'country', countryCode: 'US' }), false);
  assert.equal(validateApplicability({ kind: 'country', countryCode: 'UK' }), false);
  assert.equal(validateApplicability({ kind: 'country', countryCode: 'IR' }), false);
  assert.equal(validateApplicability({ kind: 'country', countryCode: 'DE' }), false);

  // Rejected lowercase locale codes as countries
  assert.equal(validateApplicability({ kind: 'country', countryCode: 'ro' }), false);
  assert.equal(validateApplicability({ kind: 'country', countryCode: 'fa' }), false);
  assert.equal(validateApplicability({ kind: 'country', countryCode: 'en' }), false);
});

// -----------------------------------------------------------------------------
// Conservative Taint-Aware Data-Flow Analyzer & AST Guard
// -----------------------------------------------------------------------------
function isSourceIdentifier(name) {
  if (typeof name !== 'string') return false;
  const n = name.trim();
  return /^(_)?(lang|locale|language|languageCode|langCode|currentLang|currentLocale)(_)?$/i.test(n);
}

function isSinkPropertyName(name) {
  if (typeof name !== 'string') return false;
  const n = name.trim();
  return /^(country|countryCode|jurisdiction|marketCountry)$/i.test(n);
}

function isCountryToken(str) {
  return typeof str === 'string' && /^[A-Z]{2}$/.test(str.trim());
}

function isCountryConstantIdentifier(name) {
  if (typeof name !== 'string') return false;
  const n = name.trim();
  return /^(COUNTRY_|JURISDICTION_|[A-Z]{2}_COUNTRY|COUNTRY[A-Z]{2})/i.test(n) ||
    /^(RO|IR|US|UK|DE|FR|CA|JP|AE)$/.test(n);
}

function isRegionOrCountryMapName(name) {
  if (typeof name !== 'string') return false;
  const n = name.trim();
  return /(country|jurisdiction|region)/i.test(n);
}

function isLocaleKey(name) {
  if (typeof name !== 'string') return false;
  const n = name.trim();
  return /^(ro|en|fa|de|fr|es|it|ar|[a-z]{2}(-[A-Z]{2})?)$/i.test(n) || isSourceIdentifier(n);
}

function auditSourceFile(filePath, code) {
  const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const violations = [];
  const canonicalGuideDataModule = /^src\/data\/guides(?:\/|\.ts$)/.test(filePath)
    || filePath === 'src/data/guides-articles.ts';

  // Track tainted identifiers (sources + alias propagation)
  const taintedVariables = new Set();
  const countryValuedVariables = new Set();
  const taintedMemberPaths = new Set();
  const taintedFunctions = new Set();
  const staticValueBindings = [];

  function isLexicalScope(node) {
    return ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)
      || ts.isCaseBlock(node) || ts.isForStatement(node) || ts.isForInStatement(node)
      || ts.isForOfStatement(node) || ts.isFunctionLike(node);
  }

  function nearestLexicalScope(node) {
    let current = node.parent;
    while (current && !isLexicalScope(current)) current = current.parent;
    return current ?? sf;
  }

  (function collectStaticValueBindings(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && ts.isVariableDeclarationList(node.parent)
      && (node.parent.flags & ts.NodeFlags.Const) !== 0) {
      staticValueBindings.push({
        name: node.name.text,
        initializer: node.initializer,
        declaration: node,
        scope: nearestLexicalScope(node),
      });
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.initializer) {
      staticValueBindings.push({
        name: node.name.text,
        initializer: node.initializer,
        declaration: node,
        scope: nearestLexicalScope(node),
      });
    }
    ts.forEachChild(node, collectStaticValueBindings);
  }(sf));

  function memberPath(expr) {
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr)) {
      const parent = memberPath(expr.expression);
      return parent ? `${parent}.${expr.name.text}` : expr.getText(sf);
    }
    if (ts.isElementAccessExpression(expr)) {
      const parent = memberPath(expr.expression);
      if (ts.isStringLiteral(expr.argumentExpression)
        || ts.isNoSubstitutionTemplateLiteral(expr.argumentExpression)) {
        return parent ? `${parent}.${expr.argumentExpression.text}` : expr.getText(sf);
      }
      return expr.getText(sf);
    }
    return '';
  }

  function bindingNames(pattern, inheritedSource = false, basePath = '') {
    const discovered = [];
    if (ts.isIdentifier(pattern)) {
      discovered.push({ name: pattern.text, source: inheritedSource || isSourceIdentifier(pattern.text) });
    } else if (ts.isObjectBindingPattern(pattern)) {
      for (const element of pattern.elements) {
        const propertyName = getLeafPropertyName(element.propertyName ?? element.name);
        const propertyPath = basePath && propertyName ? `${basePath}.${propertyName}` : '';
        const source = inheritedSource || isSourceIdentifier(propertyName)
          || Boolean(propertyPath && taintedMemberPaths.has(propertyPath));
        discovered.push(...bindingNames(element.name, source, propertyPath));
      }
    } else if (ts.isArrayBindingPattern(pattern)) {
      for (const element of pattern.elements) {
        if (ts.isBindingElement(element)) discovered.push(...bindingNames(element.name, inheritedSource, basePath));
      }
    }
    return discovered;
  }

  function assignmentPatternNames(pattern, inheritedSource = false, basePath = '') {
    if (ts.isParenthesizedExpression(pattern)) {
      return assignmentPatternNames(pattern.expression, inheritedSource, basePath);
    }
    if (ts.isIdentifier(pattern)) {
      return [{ name: pattern.text, source: inheritedSource || isSourceIdentifier(pattern.text) }];
    }
    if (!ts.isObjectLiteralExpression(pattern)) return [];
    const discovered = [];
    for (const property of pattern.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = getLeafPropertyName(property.name);
      const propertyPath = basePath && key ? `${basePath}.${key}` : '';
      discovered.push(...assignmentPatternNames(
        property.initializer,
        inheritedSource || isSourceIdentifier(key)
          || Boolean(propertyPath && taintedMemberPaths.has(propertyPath)),
        propertyPath,
      ));
    }
    return discovered;
  }

  function isLocaleHeaderSource(expr) {
    if (!ts.isCallExpression(expr) || expr.arguments.length < 1) return false;
    if (!ts.isPropertyAccessExpression(expr.expression) || expr.expression.name.text !== 'get') return false;
    if (!/\bheaders\b/i.test(expr.expression.expression.getText(sf))) return false;
    const header = expr.arguments[0];
    if (!ts.isStringLiteral(header) && !ts.isNoSubstitutionTemplateLiteral(header)) return false;
    return /^(accept-language|content-language|x-(locale|language|country|jurisdiction))$/i.test(header.text);
  }

  function functionReturnsTaint(fn) {
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return isTainted(fn.body);
    if (!fn.body || !ts.isBlock(fn.body)) return false;
    let returnsTaint = false;
    const inspectReturn = (child) => {
      if (returnsTaint) return;
      if (ts.isReturnStatement(child) && child.expression && isTainted(child.expression)) {
        returnsTaint = true;
        return;
      }
      if (child !== fn.body && (ts.isFunctionDeclaration(child)
        || ts.isFunctionExpression(child) || ts.isArrowFunction(child))) return;
      ts.forEachChild(child, inspectReturn);
    };
    inspectReturn(fn.body);
    return returnsTaint;
  }

  function isTainted(expr) {
    if (!expr) return false;

    // Direct identifier
    if (ts.isIdentifier(expr)) {
      const name = expr.text;
      if (isSourceIdentifier(name) || taintedVariables.has(name)) {
        return true;
      }
    }

    // Property access on tainted object (e.g. params.lang, props.locale)
    if (ts.isPropertyAccessExpression(expr)) {
      if (taintedMemberPaths.has(memberPath(expr))) return true;
      if (isSourceIdentifier(expr.name.text) || taintedVariables.has(expr.name.text)) {
        return true;
      }
      if (isTainted(expr.expression)) {
        return true;
      }
    }

    // Element access with tainted index
    if (ts.isElementAccessExpression(expr)) {
      if (taintedMemberPaths.has(memberPath(expr))) return true;
      if (isTainted(expr.argumentExpression)) {
        return true;
      }
      if (isTainted(expr.expression)) return true;
    }

    // Binary expression with tainted operand (e.g. lang === 'en', locale !== 'ro')
    if (ts.isBinaryExpression(expr)) {
      return isTainted(expr.left) || isTainted(expr.right);
    }

    // Unary expression with tainted operand (e.g. !locale)
    if (ts.isPrefixUnaryExpression(expr)) {
      return isTainted(expr.operand);
    }

    // Call expression with tainted argument (e.g. check(lang))
    if (ts.isCallExpression(expr)) {
      const callee = getLeafPropertyName(expr.expression);
      let callable = expr.expression;
      while (ts.isParenthesizedExpression(callable)) callable = callable.expression;
      if (isLocaleHeaderSource(expr)) return true;
      if ((ts.isArrowFunction(callable) || ts.isFunctionExpression(callable))
        && functionReturnsTaint(callable)) return true;
      return taintedFunctions.has(callee) || isTainted(expr.expression) || expr.arguments.some(isTainted);
    }

    if (ts.isArrayLiteralExpression(expr)) return expr.elements.some(isTainted);
    if (ts.isSpreadElement(expr)) return isTainted(expr.expression);
    if (ts.isTemplateExpression(expr)) return expr.templateSpans.some(span => isTainted(span.expression));
    if (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)
      || ts.isNonNullExpression(expr) || ts.isSatisfiesExpression(expr)
      || ts.isAwaitExpression(expr)) return isTainted(expr.expression);

    if (ts.isConditionalExpression(expr)) {
      return isTainted(expr.condition) || isTainted(expr.whenTrue) || isTainted(expr.whenFalse);
    }

    // Parenthesized expression
    if (ts.isParenthesizedExpression(expr)) {
      return isTainted(expr.expression);
    }

    return false;
  }

  // Discover aliases to a fixpoint so forward and multi-hop chains are
  // independent of source order.
  function collectAliases(node) {
    let changed = false;
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name) && node.initializer) {
        if (isTainted(node.initializer) && !taintedVariables.has(node.name.text)) {
          taintedVariables.add(node.name.text);
          changed = true;
        }
        if (shouldTrackCountryVariable(node.name.text, node.initializer)
          && !countryValuedVariables.has(node.name.text)) {
          countryValuedVariables.add(node.name.text);
          changed = true;
        }
        if (ts.isObjectLiteralExpression(node.initializer)) {
          const collectObjectMembers = (objectNode, basePath) => {
            for (const property of objectNode.properties) {
              if (ts.isSpreadAssignment(property)) {
                const sourceRoot = memberPath(property.expression);
                if (sourceRoot) {
                  for (const path of [...taintedMemberPaths]) {
                    if (!path.startsWith(`${sourceRoot}.`)) continue;
                    const spreadPath = `${basePath}${path.slice(sourceRoot.length)}`;
                    if (!taintedMemberPaths.has(spreadPath)) {
                      taintedMemberPaths.add(spreadPath);
                      changed = true;
                    }
                  }
                }
                continue;
              }
              if (!ts.isPropertyAssignment(property)) continue;
              const key = getLeafPropertyName(property.name);
              if (!key) continue;
              const path = `${basePath}.${key}`;
              if (isTainted(property.initializer) && !taintedMemberPaths.has(path)) {
                taintedMemberPaths.add(path);
                changed = true;
              }
              if (ts.isObjectLiteralExpression(property.initializer)) {
                collectObjectMembers(property.initializer, path);
              }
            }
          };
          collectObjectMembers(node.initializer, node.name.text);
        }
        const sourceRoot = memberPath(node.initializer);
        if (sourceRoot) {
          for (const path of [...taintedMemberPaths]) {
            if (!path.startsWith(`${sourceRoot}.`)) continue;
            const aliasPath = `${node.name.text}${path.slice(sourceRoot.length)}`;
            if (!taintedMemberPaths.has(aliasPath)) {
              taintedMemberPaths.add(aliasPath);
              changed = true;
            }
          }
        }
        if (ts.isIdentifier(node.initializer) && taintedFunctions.has(node.initializer.text)
          && !taintedFunctions.has(node.name.text)) {
          taintedFunctions.add(node.name.text);
          changed = true;
        }
      } else if (ts.isBindingPattern(node.name)) {
        const inheritedSource = Boolean(node.initializer && isTainted(node.initializer));
        const basePath = node.initializer ? memberPath(node.initializer) : '';
        for (const binding of bindingNames(node.name, inheritedSource, basePath)) {
          if (binding.source && !taintedVariables.has(binding.name)) {
            taintedVariables.add(binding.name);
            changed = true;
          }
        }
      }
    }

    if (ts.isParameter(node)) {
      if (ts.isIdentifier(node.name) && node.initializer && isTainted(node.initializer)
        && !taintedVariables.has(node.name.text)) {
        taintedVariables.add(node.name.text);
        changed = true;
      }
      if (ts.isBindingPattern(node.name)) {
        for (const binding of bindingNames(node.name, Boolean(node.initializer && isTainted(node.initializer)))) {
          if (binding.source && !taintedVariables.has(binding.name)) {
            taintedVariables.add(binding.name);
            changed = true;
          }
        }
      }
    }

    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      const name = functionLikeName(node);
      const returnsTaint = functionReturnsTaint(node);
      if (name && returnsTaint && !taintedFunctions.has(name)) {
        taintedFunctions.add(name);
        changed = true;
      }
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (ts.isIdentifier(node.left)) {
        if (isTainted(node.right) && !taintedVariables.has(node.left.text)) {
          taintedVariables.add(node.left.text);
          changed = true;
        }
        if (shouldTrackCountryVariable(node.left.text, node.right)
          && !countryValuedVariables.has(node.left.text)) {
          countryValuedVariables.add(node.left.text);
          changed = true;
        }
        const sourceRoot = memberPath(node.right);
        if (sourceRoot) {
          for (const path of [...taintedMemberPaths]) {
            if (!path.startsWith(`${sourceRoot}.`)) continue;
            const aliasPath = `${node.left.text}${path.slice(sourceRoot.length)}`;
            if (!taintedMemberPaths.has(aliasPath)) {
              taintedMemberPaths.add(aliasPath);
              changed = true;
            }
          }
        }
        if (ts.isIdentifier(node.right) && taintedFunctions.has(node.right.text)
          && !taintedFunctions.has(node.left.text)) {
          taintedFunctions.add(node.left.text);
          changed = true;
        }
      }
      if ((ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
        && isTainted(node.right)) {
        const path = memberPath(node.left);
        if (path && !taintedMemberPaths.has(path)) {
          taintedMemberPaths.add(path);
          changed = true;
        }
      }
      for (const binding of assignmentPatternNames(node.left, false, memberPath(node.right))) {
        if (binding.source && !taintedVariables.has(binding.name)) {
          taintedVariables.add(binding.name);
          changed = true;
        }
      }
    }

    ts.forEachChild(node, child => {
      if (collectAliases(child)) changed = true;
    });
    return changed;
  }

  // Helper to extract leaf property name from member expressions (e.g. settings.geo.countryCode -> countryCode)
  function getLeafPropertyName(expr) {
    if (!expr) return '';
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
    if (ts.isElementAccessExpression(expr) && expr.argumentExpression) {
      const constant = constantString(expr.argumentExpression);
      if (constant !== null) return constant;
    }
    if (ts.isComputedPropertyName(expr)) {
      return constantString(expr.expression) ?? expr.expression.getText(sf);
    }
    return '';
  }

  function visibleStaticBinding(expr) {
    if (!ts.isIdentifier(expr)) return null;
    const visibleDeclarations = staticValueBindings.filter(candidate => {
        if (candidate.name !== expr.text || candidate.declaration.pos >= expr.pos) return false;
        let current = expr;
        while (current) {
          if (current === candidate.scope) return true;
          current = current.parent;
        }
        return false;
      }).sort((a, b) => b.declaration.pos - a.declaration.pos);
    return visibleDeclarations[0] ?? null;
  }

  function resolveStaticExpression(expr, resolving = new Set()) {
    if (ts.isIdentifier(expr) && !resolving.has(expr.text)) {
      const binding = visibleStaticBinding(expr);
      if (!binding) return null;
      const next = new Set(resolving);
      next.add(expr.text);
      return resolveStaticExpression(binding.initializer, next) ?? binding.initializer;
    }
    if (ts.isParenthesizedExpression(expr)) return resolveStaticExpression(expr.expression, resolving);
    return expr;
  }

  function constantString(expr, resolving = new Set()) {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    if (ts.isIdentifier(expr) && !resolving.has(expr.text)) {
      const binding = visibleStaticBinding(expr);
      if (!binding) return null;
      const next = new Set(resolving);
      next.add(expr.text);
      return constantString(binding.initializer, next);
    }
    if (ts.isParenthesizedExpression(expr)) return constantString(expr.expression, resolving);
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = constantString(expr.left, resolving);
      const right = constantString(expr.right, resolving);
      return left === null || right === null ? null : left + right;
    }
    if (ts.isTemplateExpression(expr)) {
      let value = expr.head.text;
      for (const span of expr.templateSpans) {
        const expressionValue = constantString(span.expression, resolving);
        if (expressionValue === null) return null;
        value += expressionValue + span.literal.text;
      }
      return value;
    }
    return null;
  }

  function isExplicitCountryVariableName(name) {
    return isCountryConstantIdentifier(name)
      || /(country|jurisdiction|marketCountry|region)/i.test(name)
      || /^[A-Z]{2}_CODE$/.test(name);
  }

  function shouldTrackCountryVariable(name, initializer) {
    return producesCountryValue(initializer);
  }

  // Helper to check if an expression produces country semantics
  function producesCountryValue(expr) {
    if (!expr) return false;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      if (isCountryToken(expr.text.trim())) return true;
    }
    if (ts.isIdentifier(expr)) {
      if (isCountryConstantIdentifier(expr.text) || countryValuedVariables.has(expr.text)) {
        return true;
      }
    }
    if (ts.isObjectLiteralExpression(expr)) {
      return hasSinkProperty(expr);
    }
    if (ts.isConditionalExpression(expr)) {
      return producesCountryValue(expr.whenTrue) || producesCountryValue(expr.whenFalse);
    }
    if (ts.isParenthesizedExpression(expr)) {
      return producesCountryValue(expr.expression);
    }
    return false;
  }

  function isExplicitCountryExpression(expr) {
    if (!expr) return false;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return isCountryToken(expr.text.trim());
    }
    if (ts.isIdentifier(expr)) {
      return isExplicitCountryVariableName(expr.text)
        || (countryValuedVariables.has(expr.text) && !isPresentationCountryName(expr.text));
    }
    if (ts.isObjectLiteralExpression(expr)) return hasSinkProperty(expr);
    if (ts.isConditionalExpression(expr)) {
      return isExplicitCountryExpression(expr.whenTrue) || isExplicitCountryExpression(expr.whenFalse);
    }
    if (ts.isParenthesizedExpression(expr)) return isExplicitCountryExpression(expr.expression);
    return false;
  }

  // Recursive check for sink properties in object literals at ANY depth
  function hasSinkProperty(objNode) {
    if (!ts.isObjectLiteralExpression(objNode)) return false;
    for (const prop of objNode.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = getLeafPropertyName(prop.name);
        if (isSinkPropertyName(key)) {
          if (!/^country$/i.test(key) || producesCountryValue(prop.initializer)
            || ts.isObjectLiteralExpression(prop.initializer)) return true;
        }
        if (ts.isObjectLiteralExpression(prop.initializer)) {
          if (hasSinkProperty(prop.initializer)) return true;
        }
      }
    }
    return false;
  }

  function isAllowedCanonicalApplicabilityProperty(prop, key) {
    if (!canonicalGuideDataModule || !/^countryCode$/i.test(key)
      || !ts.isStringLiteral(prop.initializer) || prop.initializer.text !== 'RO') return false;
    const objectNode = prop.parent;
    if (!ts.isObjectLiteralExpression(objectNode)) return false;
    const owner = objectNode.parent;
    if (!ts.isPropertyAssignment(owner) || getLeafPropertyName(owner.name) !== 'contentApplicability') {
      return false;
    }
    return objectNode.properties.some(candidate => ts.isPropertyAssignment(candidate)
      && getLeafPropertyName(candidate.name) === 'kind'
      && ts.isStringLiteral(candidate.initializer)
      && candidate.initializer.text === 'country');
  }

  function isPresentationCountryLabel(prop, key) {
    if (!/^country$/i.test(key) || !ts.isStringLiteral(prop.initializer)
      || isCountryToken(prop.initializer.text)) return false;
    const objectNode = prop.parent;
    const owner = objectNode?.parent;
    return ts.isPropertyAssignment(owner) && getLeafPropertyName(owner.name) === 'labels';
  }

  function isPresentationCountryName(name) {
    return /(label|display|format|formatter|title|name|copy|text|flag|icon|emoji|symbol)/i.test(name ?? '');
  }

  function isCountryOperationName(name) {
    return /(country|jurisdiction|marketCountry)/i.test(name ?? '')
      && !isPresentationCountryName(name);
  }

  function isAssignmentOperator(kind) {
    return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
  }

  function collectStructuralSinkTargets(target, discovered = []) {
    if (!target) return discovered;
    if (ts.isParenthesizedExpression(target)) {
      return collectStructuralSinkTargets(target.expression, discovered);
    }
    if (ts.isIdentifier(target) || ts.isPropertyAccessExpression(target)
      || ts.isElementAccessExpression(target)) {
      const key = getLeafPropertyName(target);
      if (isSinkPropertyName(key)) discovered.push(target.getText(sf));
      return discovered;
    }
    if (ts.isObjectLiteralExpression(target)) {
      for (const property of target.properties) {
        if (ts.isPropertyAssignment(property)) {
          collectStructuralSinkTargets(property.initializer, discovered);
        } else if (ts.isShorthandPropertyAssignment(property)) {
          collectStructuralSinkTargets(property.name, discovered);
        } else if (ts.isSpreadAssignment(property)) {
          collectStructuralSinkTargets(property.expression, discovered);
        }
      }
      return discovered;
    }
    if (ts.isArrayLiteralExpression(target)) {
      for (const element of target.elements) {
        if (!ts.isOmittedExpression(element)) collectStructuralSinkTargets(element, discovered);
      }
    }
    return discovered;
  }

  function collectStructuralBindingSinks(binding, discovered = []) {
    if (ts.isIdentifier(binding)) {
      if (isSinkPropertyName(binding.text)) discovered.push(binding.text);
      return discovered;
    }
    if (ts.isObjectBindingPattern(binding)) {
      for (const element of binding.elements) {
        const sourceKey = getLeafPropertyName(element.propertyName ?? element.name);
        if (isCountryOperationName(sourceKey)) {
          discovered.push(sourceKey);
        }
        collectStructuralBindingSinks(element.name, discovered);
      }
      return discovered;
    }
    if (ts.isArrayBindingPattern(binding)) {
      for (const element of binding.elements) {
        if (ts.isBindingElement(element)) collectStructuralBindingSinks(element.name, discovered);
      }
    }
    return discovered;
  }

  function isStaticMemberCall(expression, owner, method) {
    let methodOwner = null;
    let methodName = null;
    if (ts.isPropertyAccessExpression(expression)) {
      methodOwner = expression.expression;
      methodName = expression.name.text;
    } else if (ts.isElementAccessExpression(expression)) {
      methodOwner = expression.expression;
      methodName = constantString(expression.argumentExpression);
    }
    if (!methodOwner || methodName !== method) return false;
    if (ts.isIdentifier(methodOwner)) return methodOwner.text === owner;
    if (ts.isPropertyAccessExpression(methodOwner)) {
      return ts.isIdentifier(methodOwner.expression)
        && methodOwner.expression.text === 'globalThis'
        && methodOwner.name.text === owner;
    }
    return ts.isElementAccessExpression(methodOwner)
      && ts.isIdentifier(methodOwner.expression)
      && methodOwner.expression.text === 'globalThis'
      && constantString(methodOwner.argumentExpression) === owner;
  }

  function forbiddenDynamicPropertyApiAliases(binding, initializer) {
    if (!ts.isObjectBindingPattern(binding) || !initializer) return [];
    const objectOwner = (ts.isIdentifier(initializer) && initializer.text === 'Object')
      || (ts.isPropertyAccessExpression(initializer)
        && ts.isIdentifier(initializer.expression)
        && initializer.expression.text === 'globalThis'
        && initializer.name.text === 'Object')
      || (ts.isElementAccessExpression(initializer)
        && ts.isIdentifier(initializer.expression)
        && initializer.expression.text === 'globalThis'
        && constantString(initializer.argumentExpression) === 'Object');
    const reflectOwner = (ts.isIdentifier(initializer) && initializer.text === 'Reflect')
      || (ts.isPropertyAccessExpression(initializer)
        && ts.isIdentifier(initializer.expression)
        && initializer.expression.text === 'globalThis'
        && initializer.name.text === 'Reflect')
      || (ts.isElementAccessExpression(initializer)
        && ts.isIdentifier(initializer.expression)
        && initializer.expression.text === 'globalThis'
        && constantString(initializer.argumentExpression) === 'Reflect');
    if (!objectOwner && !reflectOwner) return [];
    const forbidden = objectOwner
      ? new Set(['fromEntries', 'defineProperty', 'defineProperties'])
      : new Set(['set', 'defineProperty']);
    return binding.elements
      .map(element => getLeafPropertyName(element.propertyName ?? element.name))
      .filter(name => forbidden.has(name));
  }

  function isPresentationComputedProperty(property) {
    if (!ts.isPropertyAssignment(property) || !ts.isComputedPropertyName(property.name)
      || !isTainted(property.name.expression)) return false;
    const objectNode = property.parent;
    const owner = objectNode?.parent;
    let ownerName = '';
    if (ts.isVariableDeclaration(owner) && ts.isIdentifier(owner.name)) ownerName = owner.name.text;
    if (ts.isPropertyAssignment(owner)) ownerName = getLeafPropertyName(owner.name);
    return /^(translations?|labels?|messages?|copy)$/i.test(ownerName);
  }

  function structuralMutationApiSink(call) {
    if (isStaticMemberCall(call.expression, 'Reflect', 'set') && call.arguments.length >= 2) {
      const key = constantString(call.arguments[1]) ?? '';
      return isSinkPropertyName(key) || isCountryOperationName(key) ? key : '';
    }
    if (isStaticMemberCall(call.expression, 'Object', 'defineProperty') && call.arguments.length >= 2) {
      const key = constantString(call.arguments[1]) ?? '';
      return isSinkPropertyName(key) || isCountryOperationName(key) ? key : '';
    }
    if (isStaticMemberCall(call.expression, 'Reflect', 'defineProperty') && call.arguments.length >= 2) {
      const key = constantString(call.arguments[1]) ?? '';
      return isSinkPropertyName(key) || isCountryOperationName(key) ? key : '';
    }
    if (isStaticMemberCall(call.expression, 'Object', 'defineProperties') && call.arguments.length >= 2
      && ts.isObjectLiteralExpression(call.arguments[1])) {
      for (const property of call.arguments[1].properties) {
        if (ts.isPropertyAssignment(property)) {
          const key = getLeafPropertyName(property.name);
          if (isSinkPropertyName(key) || isCountryOperationName(key)) return key;
        }
      }
    }
    if (getLeafPropertyName(call.expression) === 'set' && call.arguments.length >= 1) {
      const key = constantString(call.arguments[0]) ?? '';
      return isSinkPropertyName(key) || isCountryOperationName(key) ? key : '';
    }
    if (isStaticMemberCall(call.expression, 'Object', 'fromEntries') && call.arguments.length >= 1
      ) {
      const entries = resolveStaticExpression(call.arguments[0]);
      if (!entries || !ts.isArrayLiteralExpression(entries)) return '';
      for (const entry of entries.elements) {
        if (!ts.isArrayLiteralExpression(entry) || entry.elements.length < 1) continue;
        const key = constantString(entry.elements[0]);
        if (isSinkPropertyName(key ?? '') || isCountryOperationName(key ?? '')) return key;
      }
    }
    return '';
  }

  function forbiddenDynamicPropertyApi(expression) {
    return isStaticMemberCall(expression, 'Object', 'fromEntries')
      || isStaticMemberCall(expression, 'Object', 'defineProperty')
      || isStaticMemberCall(expression, 'Object', 'defineProperties')
      || isStaticMemberCall(expression, 'Reflect', 'set')
      || isStaticMemberCall(expression, 'Reflect', 'defineProperty');
  }

  // Recursive check for tainted values assigned to sink properties in object literals at ANY depth
  function checkObjectForTaintedSinks(objNode, currentPath = '') {
    if (!ts.isObjectLiteralExpression(objNode)) return;

    for (const prop of objNode.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = getLeafPropertyName(prop.name);
        const fullPath = currentPath ? `${currentPath}.${key}` : key;

        // Check if property is sink
        if (isSinkPropertyName(key)) {
          // If value is tainted
          if (isTainted(prop.initializer)) {
            violations.push(`Tainted value flowing into sink property "${fullPath}" in ${filePath}`);
          }
          // If value is computed lookup with tainted index
          if (ts.isElementAccessExpression(prop.initializer) && isTainted(prop.initializer.argumentExpression)) {
            violations.push(`Computed lookup with tainted index assigned to sink property "${fullPath}" in ${filePath}`);
          }
        }

        // Check if key is a locale key mapping directly to a country token or nested sink
        if (isLocaleKey(key)) {
          if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
            const parentName = getLeafPropertyName(objNode.parent?.name || '');
            if (isRegionOrCountryMapName(parentName) && isCountryToken(prop.initializer.text)) {
              violations.push(`Locale-keyed country map "${fullPath}: '${prop.initializer.text}'" in ${filePath}`);
            }
          } else if (ts.isObjectLiteralExpression(prop.initializer)
            && hasSinkProperty(prop.initializer)) {
            violations.push(`Locale-keyed nested country mapping "${fullPath}" in ${filePath}`);
          }
        }

        if (ts.isComputedPropertyName(prop.name) && isTainted(prop.name.expression)
          && ts.isObjectLiteralExpression(prop.initializer) && hasSinkProperty(prop.initializer)) {
          violations.push(`Locale-tainted computed key creates nested country mapping "${fullPath}" in ${filePath}`);
        }

        // Recurse into nested objects at unbounded depth
        if (ts.isObjectLiteralExpression(prop.initializer)) {
          checkObjectForTaintedSinks(prop.initializer, fullPath);
        }
      }
    }
  }

  do {
    // The sets grow monotonically and are bounded by identifiers in the file.
  } while (collectAliases(sf));

  function functionLikeName(fn) {
    if (fn.name) return fn.name.getText(sf);
    if (ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) {
      return fn.parent.name.text;
    }
    if (ts.isPropertyAssignment(fn.parent)) return getLeafPropertyName(fn.parent.name);
    return '';
  }

  function enclosingFunctionName(node) {
    let current = node.parent;
    while (current) {
      if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)
        || ts.isFunctionExpression(current)) {
        return functionLikeName(current);
      }
      if (ts.isArrowFunction(current)) return functionLikeName(current);
      current = current.parent;
    }
    return '';
  }

  // Second pass: Detect taint violations across AST
  function checkNode(node) {
    // Structural invariant: executable Guide/route modules may read canonical
    // applicability metadata for presentation, but may not construct, assign,
    // resolve or dispatch country/jurisdiction state. Canonical article data is
    // allowlisted only for the exact closed `country/RO` applicability shape.
    if (ts.isPropertyAssignment(node)) {
      const key = getLeafPropertyName(node.name);
      if (isSinkPropertyName(key)
        && !isAllowedCanonicalApplicabilityProperty(node, key)
        && !isPresentationCountryLabel(node, key)) {
        violations.push(`Structural country/jurisdiction property creation "${key}" is forbidden in ${filePath}`);
      }
      if (isCountryOperationName(key)
        && !isSinkPropertyName(key)) {
        violations.push(`Structural country/jurisdiction resolver property "${key}" is forbidden in ${filePath}`);
      }
      if (ts.isComputedPropertyName(node.name) && constantString(node.name.expression) === null
        && !isPresentationComputedProperty(node)
        && (isTainted(node.initializer) || producesCountryValue(node.initializer))) {
        violations.push(`Tainted computed property construction is forbidden in executable Guide code in ${filePath}`);
      }
    }
    if (ts.isShorthandPropertyAssignment(node)
      && isCountryOperationName(node.name.text)) {
      violations.push(`Structural country/jurisdiction resolver property "${node.name.text}" is forbidden in ${filePath}`);
    }
    if (ts.isBinaryExpression(node)
      && isAssignmentOperator(node.operatorToken.kind)) {
      for (const target of collectStructuralSinkTargets(node.left)) {
        violations.push(`Structural country/jurisdiction assignment "${target}" is forbidden in ${filePath}`);
      }
    }
    if (ts.isVariableDeclaration(node)) {
      for (const sink of collectStructuralBindingSinks(node.name)) {
        violations.push(`Structural country/jurisdiction variable "${sink}" is forbidden in ${filePath}`);
      }
      for (const api of forbiddenDynamicPropertyApiAliases(node.name, node.initializer)) {
        violations.push(`Dynamic property construction API alias "${api}" is forbidden in Guide code in ${filePath}`);
      }
    }
    if (ts.isParameter(node)) {
      for (const sink of collectStructuralBindingSinks(node.name)) {
        violations.push(`Structural country/jurisdiction parameter "${sink}" is forbidden in ${filePath}`);
      }
    }
    if (ts.isPropertyDeclaration(node) || ts.isGetAccessorDeclaration(node)
        || ts.isSetAccessorDeclaration(node)) {
      const key = getLeafPropertyName(node.name);
      if (isSinkPropertyName(key) || isCountryOperationName(key)) {
        violations.push(`Structural country/jurisdiction class member "${key}" is forbidden in ${filePath}`);
      }
    }

    // 1. Check all object literals for tainted sinks at ANY depth
    if (ts.isObjectLiteralExpression(node)) {
      checkObjectForTaintedSinks(node);
    }

    // 2. Member Expression Assignment (e.g. settings.countryCode = locale, or countryCode = market)
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const leafName = getLeafPropertyName(node.left);
      if (isSinkPropertyName(leafName)) {
        if (isTainted(node.right)) {
          violations.push(`Tainted assignment to sink "${node.left.getText(sf)}" in ${filePath}`);
        } else if (producesCountryValue(node.right)) {
          if (ts.isConditionalExpression(node.right) && isTainted(node.right.condition)) {
            violations.push(`Conditional assignment to sink "${node.left.getText(sf)}" on tainted condition in ${filePath}`);
          }
        }
      }
    }

    // 3. Variable Declaration where variable is sink (e.g. const countryCode = market)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const varName = node.name.text;
      if (isSinkPropertyName(varName) && node.initializer) {
        if (isTainted(node.initializer)) {
          violations.push(`Tainted variable declaration for sink "${varName}" in ${filePath}`);
        } else if (ts.isConditionalExpression(node.initializer) && isTainted(node.initializer.condition) && producesCountryValue(node.initializer)) {
          violations.push(`Conditional initialization of sink "${varName}" on tainted condition in ${filePath}`);
        }
      }
    }

    // 4. Computed lookup with tainted index on region/country maps
    if (ts.isElementAccessExpression(node)) {
      const indexExpr = node.argumentExpression;
      if (isTainted(indexExpr)) {
        const objExpr = node.expression;
        const objName = getLeafPropertyName(objExpr);

        if (isRegionOrCountryMapName(objName)) {
          violations.push(`Computed lookup on region/country map "${objExpr.getText(sf)}[${indexExpr.getText(sf)}]" with tainted index in ${filePath}`);
        }
      }
    }

    // 5. Conditional / Ternary Expressions conditioned on tainted variable
    if (ts.isConditionalExpression(node)) {
      if (isTainted(node.condition)) {
        const trueYieldsCountry = isExplicitCountryExpression(node.whenTrue);
        const falseYieldsCountry = isExplicitCountryExpression(node.whenFalse);
        if (trueYieldsCountry || falseYieldsCountry) {
          violations.push(`Ternary on tainted condition yielding country token/object in ${filePath}`);
        }
      }
    }

    // 6. Switch statement on tainted expression
    if (ts.isSwitchStatement(node)) {
      if (isTainted(node.expression)) {
        for (const clause of node.caseBlock.clauses) {
          function checkClause(child) {
            if (isExplicitCountryExpression(child)) {
              violations.push(`Switch on tainted expression producing country token/object in ${filePath}`);
            }
            ts.forEachChild(child, checkClause);
          }
          for (const s of clause.statements) {
            checkClause(s);
          }
        }
      }
    }

    // 7. A locale-tainted lookup returned from a country/jurisdiction resolver
    // is itself a sink even if an intermediate local has a neutral name.
    if (ts.isReturnStatement(node) && node.expression && isTainted(node.expression)) {
      const owner = enclosingFunctionName(node);
      if (isCountryOperationName(owner)) {
        violations.push(`Tainted return from country/jurisdiction function "${owner}" in ${filePath}`);
      }
    }

    if (ts.isArrowFunction(node) && !ts.isBlock(node.body) && isTainted(node.body)) {
      const owner = functionLikeName(node);
      if (isCountryOperationName(owner)) {
        violations.push(`Tainted return from country/jurisdiction function "${owner}" in ${filePath}`);
      }
    }

    // 8. Forbidden helper function names combining (country|jurisdiction) and (locale|lang|language)
    let fnName = '';
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      fnName = node.name ? node.name.getText(sf) : '';
    } else if (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      fnName = node.name ? node.name.getText(sf) : '';
    }
    if (fnName) {
      const hasCountry = /(country|jurisdiction)/i.test(fnName);
      const hasLocale = /(locale|lang|language)/i.test(fnName);
      if (hasCountry && hasLocale) {
        violations.push(`Forbidden helper function "${fnName}" in ${filePath}`);
      }
      if (isCountryOperationName(fnName)) {
        violations.push(`Structural country/jurisdiction resolver "${fnName}" is forbidden in ${filePath}`);
      }
    }

    if (ts.isMethodDeclaration(node)) {
      const methodName = getLeafPropertyName(node.name);
      if (isCountryOperationName(methodName)) {
        violations.push(`Structural country/jurisdiction resolver "${methodName}" is forbidden in ${filePath}`);
      }
    }

    // 9. Function calls and JSX attributes named as country/jurisdiction sinks.
    if (ts.isCallExpression(node)) {
      if ((node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        && (node.arguments.length !== 1
          || (!ts.isStringLiteral(node.arguments[0])
            && !ts.isNoSubstitutionTemplateLiteral(node.arguments[0])))) {
        violations.push(`Dynamic module specifier is forbidden in executable Guide code in ${filePath}`);
      }
      const callee = getLeafPropertyName(node.expression);
      if (isCountryOperationName(callee)) {
        violations.push(`Country/jurisdiction call sink "${node.expression.getText(sf)}" is forbidden in ${filePath}`);
      }
      const mutationSink = structuralMutationApiSink(node);
      if (mutationSink) {
        violations.push(`Structural mutation API cannot create country/jurisdiction sink "${mutationSink}" in ${filePath}`);
      }
      if (node.arguments.length >= 2
        && isSinkPropertyName(constantString(node.arguments[0]) ?? '')
        && node.arguments.slice(1).some(isTainted)) {
        violations.push(`Aliased mutation call cannot create a country/jurisdiction sink in ${filePath}`);
      }
    }
    if (ts.isJsxAttribute(node)
      && isSinkPropertyName(node.name.text)) {
      violations.push(`Structural JSX country/jurisdiction sink "${node.name.text}" is forbidden in ${filePath}`);
    }

    if (forbiddenDynamicPropertyApi(node)) {
      violations.push(`Dynamic property construction API "${node.getText(sf)}" is forbidden in Guide code in ${filePath}`);
    }

    ts.forEachChild(node, checkNode);
  }

  checkNode(sf);
  return violations;
}

// -----------------------------------------------------------------------------
// Independent Taint-Aware Bypass Regressions
// -----------------------------------------------------------------------------
runAssertion('Taint Regression: deep nested countryCode is rejected by AST data-flow analysis', () => {
  const code = `
    const config = {
      settings: {
        profile: {
          geo: {
            countryCode: locale
          }
        }
      }
    };
  `;
  const violations = auditSourceFile('test-deep-nested.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted value flowing into sink property "settings.profile.geo.countryCode"')),
    `Must flag deep nested countryCode, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: settings.countryCode = locale member assignment is rejected by AST data-flow analysis', () => {
  const code = `settings.countryCode = locale;`;
  const violations = auditSourceFile('test-settings-countrycode.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "settings.countryCode"')),
    `Must flag settings.countryCode = locale, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: alias propagation (const market = locale; countryCode = market) is rejected by AST data-flow analysis', () => {
  const code = `
    const market = locale;
    countryCode = market;
  `;
  const violations = auditSourceFile('test-alias-propagation.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "countryCode"')),
    `Must flag alias propagation into sink, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: computed lookup with tainted index (regionMap[locale]) is rejected independent of map name', () => {
  const code = `const r = regionMap[locale];`;
  const violations = auditSourceFile('test-region-map.ts', code);
  assert.ok(violations.some((v) => v.includes('Computed lookup on region/country map "regionMap[locale]"')),
    `Must flag regionMap[locale], got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: computed lookup with source alias (countryByLocale[languageCode]) is rejected', () => {
  const code = `const c = countryByLocale[languageCode];`;
  const violations = auditSourceFile('test-country-by-locale.ts', code);
  assert.ok(violations.some((v) => v.includes('Computed lookup on region/country map "countryByLocale[languageCode]"')),
    `Must flag countryByLocale[languageCode], got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: ternary with country constant identifiers (COUNTRY_DE / COUNTRY_FR) is rejected', () => {
  const code = `const c = lang === 'en' ? COUNTRY_FR : COUNTRY_DE;`;
  const violations = auditSourceFile('test-ternary-country-constants.ts', code);
  assert.ok(violations.some((v) => v.includes('Ternary on tainted condition yielding country token/object')),
    `Must flag ternary with COUNTRY_DE / COUNTRY_FR, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: ternary returning countryCode objects is rejected', () => {
  const code = `const res = lang === 'ro' ? { countryCode: 'RO' } : { countryCode: 'GLOBAL' };`;
  const violations = auditSourceFile('test-ternary-country-objects.ts', code);
  assert.ok(violations.some((v) => v.includes('Ternary on tainted condition yielding country token/object')),
    `Must flag ternary with countryCode objects, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: benign translation dictionary ({ en: "OK", ro: "RO", fa: "FA" }) produces zero false-positive unless flowing into sink', () => {
  const code = `
    const labels = { en: 'OK', ro: 'RO', fa: 'FA' };
    const buttonText = labels[locale];
    console.log(buttonText);
  `;
  const violations = auditSourceFile('test-benign-dict.ts', code);
  assert.equal(violations.length, 0,
    `Benign translation dictionary must yield 0 false positives, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: translation dictionary flowing into country/jurisdiction sink is strictly rejected', () => {
  const code = `
    const labels = { en: 'OK', ro: 'RO', fa: 'FA' };
    countryCode = labels[locale];
  `;
  const violations = auditSourceFile('test-dict-to-sink.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "countryCode"')),
    `Dictionary flowing into sink must be flagged, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: locale-keyed deeply nested static country mapping is rejected', () => {
  const code = `
    const lookup = {
      en: { config: { geo: { countryCode: 'US' } } },
      fa: { config: { geo: { countryCode: 'IR' } } },
    };
  `;
  const violations = auditSourceFile('test-static-nested-country-map.ts', code);
  assert.ok(violations.some((v) => v.includes('Locale-keyed nested country mapping')),
    `Must flag static nested locale-to-country mapping, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: arbitrary computed lookup returned by a country resolver is rejected', () => {
  const code = `
    function resolveCountry(locale) {
      const code = lookup[locale];
      return code;
    }
  `;
  const violations = auditSourceFile('test-country-resolver-return.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted return from country/jurisdiction function "resolveCountry"')),
    `Must flag tainted computed lookup returned as country, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: forward alias chains are rejected independent of declaration order', () => {
  const code = `
    const market = source;
    const source = locale;
    result.countryCode = market;
  `;
  const violations = auditSourceFile('test-forward-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must flag forward alias chain into country sink, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: ternary using locally declared country constants is rejected', () => {
  const code = `
    const DE_CODE = 'DE';
    const FR_CODE = 'FR';
    countryCode = locale === 'de' ? DE_CODE : FR_CODE;
  `;
  const violations = auditSourceFile('test-local-country-constants.ts', code);
  assert.ok(violations.some((v) => v.includes('assignment to sink "countryCode"')
      || v.includes('Ternary on tainted condition yielding country token/object')),
    `Must flag local constants selected by locale, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: concise country resolver arrow returning locale lookup is rejected', () => {
  const code = `const resolveCountry = locale => lookup[locale];`;
  const violations = auditSourceFile('test-country-resolver-arrow.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted return from country/jurisdiction function "resolveCountry"')),
    `Must flag concise arrow country resolver, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: anonymous function expression country resolver is rejected', () => {
  const code = `
    const resolveCountry = function(locale) {
      const code = lookup[locale];
      return code;
    };
  `;
  const violations = auditSourceFile('test-country-resolver-function-expression.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted return from country/jurisdiction function "resolveCountry"')),
    `Must flag function-expression country resolver, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: computed locale property creating nested country mapping is rejected', () => {
  const code = `const lookup = { [locale]: { countryCode: 'DE' } };`;
  const violations = auditSourceFile('test-computed-locale-country-map.ts', code);
  assert.ok(violations.some((v) => v.includes('Locale-tainted computed key creates nested country mapping')),
    `Must flag computed locale property country mapping, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: destructured locale alias flowing into country sink is rejected', () => {
  const code = `
    const { locale: selected } = params;
    result.countryCode = selected;
  `;
  const violations = auditSourceFile('test-destructured-locale-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must flag destructured locale alias, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: nested translation country labels remain presentation-only', () => {
  const code = `
    const labels = {
      en: { labels: { country: 'Country' } },
      ro: { labels: { country: 'Țară' } },
    };
    const selected = labels[locale];
    console.log(selected.labels.country);
  `;
  const violations = auditSourceFile('test-country-translation-label.ts', code);
  assert.equal(violations.length, 0,
    `Translation labels must not become country authority, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: locale-selected two-letter UI label constants remain presentation-only', () => {
  const code = `
    const OK_LABEL = 'OK';
    const RO_LABEL = 'RO';
    const buttonLabel = locale === 'en' ? OK_LABEL : RO_LABEL;
    console.log(buttonLabel);
  `;
  const violations = auditSourceFile('test-two-letter-ui-labels.ts', code);
  assert.equal(violations.length, 0,
    `Two-letter UI labels must not become country authority, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: destructured locale function parameter is tainted', () => {
  const code = `
    function resolveCountry({ locale: selected }) {
      return lookup[selected];
    }
  `;
  const violations = auditSourceFile('test-destructured-parameter.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted return from country/jurisdiction function "resolveCountry"')),
    `Must flag destructured function parameter, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: concise resolver with destructured locale parameter is tainted', () => {
  const code = `const resolveCountry = ({ locale: selected }) => lookup[selected];`;
  const violations = auditSourceFile('test-destructured-arrow-parameter.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted return from country/jurisdiction function "resolveCountry"')),
    `Must flag concise destructured parameter resolver, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: destructuring assignment alias flowing into country sink is rejected', () => {
  const code = `
    ({ locale: selected } = params);
    result.countryCode = selected;
  `;
  const violations = auditSourceFile('test-destructuring-assignment.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must flag destructuring assignment alias, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: computed static locale keys with country objects are rejected', () => {
  const code = `
    const mapping = {
      ['en']: { countryCode: 'US' },
      [\`fa\`]: { countryCode: 'IR' },
    };
  `;
  const violations = auditSourceFile('test-computed-static-locale-map.ts', code);
  assert.ok(violations.filter((v) => v.includes('Locale-keyed nested country mapping')).length >= 2,
    `Must flag computed static locale keys, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: taint propagates through temporary member assignment', () => {
  const code = `
    state.selection = locale;
    result.countryCode = state.selection;
  `;
  const violations = auditSourceFile('test-member-assignment-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must track taint through member assignment, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: taint propagates through computed member assignment', () => {
  const code = `
    state['selection'] = language;
    result.jurisdiction = state.selection;
  `;
  const violations = auditSourceFile('test-computed-member-assignment-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.jurisdiction"')),
    `Must track taint through computed member assignment, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: taint propagates through nested object member initialization', () => {
  const code = `
    const holder = { config: { selection: currentLocale } };
    result.marketCountry = holder.config.selection;
  `;
  const violations = auditSourceFile('test-object-member-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.marketCountry"')),
    `Must track taint through nested object members, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: tainted member survives later destructuring', () => {
  const code = `
    state.selection = locale;
    const { selection: chosen } = state;
    result.countryCode = chosen;
  `;
  const violations = auditSourceFile('test-member-destructuring-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must track tainted members through destructuring, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: tainted member survives object aliasing', () => {
  const code = `
    state.selection = locale;
    const copy = state;
    result.jurisdiction = copy.selection;
  `;
  const violations = auditSourceFile('test-member-object-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.jurisdiction"')),
    `Must track tainted members through object aliases, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: quoted and computed locale parameter bindings are tainted', () => {
  for (const [label, parameter] of [
    ['quoted', "{ 'locale': selected }"],
    ['computed', "{ ['locale']: selected }"],
  ]) {
    const code = `function resolveCountry(${parameter}) { return lookup[selected]; }`;
    const violations = auditSourceFile(`test-${label}-parameter-binding.ts`, code);
    assert.ok(violations.some((v) => v.includes('Tainted return from country/jurisdiction function "resolveCountry"')),
      `Must flag ${label} locale parameter binding, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Taint Regression: quoted locale destructuring assignment is tainted', () => {
  const code = `
    ({ 'locale': selected } = params);
    result.countryCode = selected;
  `;
  const violations = auditSourceFile('test-quoted-destructuring-assignment.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must flag quoted locale destructuring assignment, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: default parameter alias from locale is tainted', () => {
  const code = `function resolveCountry(selected = locale) { return lookup[selected]; }`;
  const violations = auditSourceFile('test-default-parameter-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted return from country/jurisdiction function "resolveCountry"')),
    `Must flag default parameter locale alias, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: template-literal element-access sink is normalized', () => {
  const code = 'result[`countryCode`] = locale;';
  const violations = auditSourceFile('test-template-element-sink.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result[`countryCode`]"')),
    `Must flag template-literal element sink, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: tainted object members propagate through object spread', () => {
  const code = `
    const state = { selection: locale };
    const clone = { ...state };
    function resolveCountry() { return lookup[clone.selection]; }
  `;
  const violations = auditSourceFile('test-object-spread-member-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted return from country/jurisdiction function "resolveCountry"')),
    `Must propagate tainted members through object spread, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: zero-argument helper return taint propagates into country sink', () => {
  const code = `
    const choose = () => lookup[locale];
    result.countryCode = choose();
  `;
  const violations = auditSourceFile('test-helper-return-summary.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must propagate tainted helper return into sink, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: array aliases preserve locale taint', () => {
  const code = `
    const values = [locale];
    const [selected] = values;
    result.jurisdiction = selected;
  `;
  const violations = auditSourceFile('test-array-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.jurisdiction"')),
    `Must propagate locale taint through arrays, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: tainted helper function aliases remain tainted', () => {
  const code = `
    const getLocale = () => locale;
    const alias = getLocale;
    result.countryCode = alias();
  `;
  const violations = auditSourceFile('test-helper-function-alias.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must propagate taint through function aliases, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: tainted IIFE result flowing into country sink is rejected', () => {
  const code = `result.countryCode = (() => locale)();`;
  const violations = auditSourceFile('test-iife-taint.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must flag tainted IIFE result, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: constant-folded computed country sink is normalized', () => {
  const code = `result['country' + 'Code'] = locale;`;
  const violations = auditSourceFile('test-constant-computed-sink.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result[\'country\' + \'Code\']"')),
    `Must flag constant-folded computed sink, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: locale-bearing browser headers are explicit taint sources', () => {
  for (const accessor of [
    "request.headers.get('accept-language')",
    "headers().get('Accept-Language')",
    "request.headers.get('x-locale')",
  ]) {
    const code = `
      const selected = ${accessor};
      function resolveCountry() { return lookup[selected]; }
    `;
    const violations = auditSourceFile('test-browser-locale-header.ts', code);
    assert.ok(violations.some((v) => v.includes('Tainted return from country/jurisdiction function "resolveCountry"')),
      `Must flag locale header ${accessor}, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Taint Regression: unrelated browser headers remain benign', () => {
  const code = `
    const contentType = request.headers.get('content-type');
    console.log(contentType);
  `;
  const violations = auditSourceFile('test-benign-browser-header.ts', code);
  assert.equal(violations.length, 0,
    `Unrelated browser header must remain benign, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: TypeScript wrappers and templates preserve taint', () => {
  for (const [label, expression] of [
    ['as-expression', 'locale as string'],
    ['non-null', 'locale!'],
    ['satisfies', 'locale satisfies string'],
    ['template', '`${locale}`'],
  ]) {
    const violations = auditSourceFile(`test-${label}-taint.ts`, `result.countryCode = ${expression};`);
    assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
      `Must preserve taint through ${label}, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Taint Regression: method chains preserve locale taint', () => {
  const code = `result.countryCode = locale.trim().toUpperCase();`;
  const violations = auditSourceFile('test-method-chain-taint.ts', code);
  assert.ok(violations.some((v) => v.includes('Tainted assignment to sink "result.countryCode"')),
    `Must preserve locale taint through method chains, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: country setter calls reject locale-tainted arguments', () => {
  const code = `settings.setCountryCode(currentLocale);`;
  const violations = auditSourceFile('test-country-setter-sink.ts', code);
  assert.ok(violations.some((v) => v.includes('Country/jurisdiction call sink "settings.setCountryCode"')),
    `Must flag country setter call, got: ${JSON.stringify(violations)}`);
});

runAssertion('Taint Regression: JSX country sinks reject locale-tainted values', () => {
  const code = `const view = <Guide countryCode={language} />;`;
  const violations = auditSourceFile('test-jsx-country-sink.tsx', code);
  assert.ok(violations.some((v) => v.includes('Structural JSX country/jurisdiction sink "countryCode"')),
    `Must flag JSX country sink, got: ${JSON.stringify(violations)}`);
});

runAssertion('Structural Regression: helper functions hidden in objects cannot create country state', () => {
  const code = `
    const getLocale = () => locale;
    const helpers = { get: getLocale };
    result.countryCode = helpers.get();
  `;
  const violations = auditSourceFile('test-object-helper-country-state.ts', code);
  assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction assignment "result.countryCode"')),
    `Must reject object-hidden helpers at the country boundary, got: ${JSON.stringify(violations)}`);
});

runAssertion('Structural Regression: bound helper aliases cannot create country state', () => {
  const code = `
    const getLocale = () => locale;
    const alias = getLocale.bind(null);
    result.countryCode = alias();
  `;
  const violations = auditSourceFile('test-bound-helper-country-state.ts', code);
  assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction assignment "result.countryCode"')),
    `Must reject bound helper aliases at the country boundary, got: ${JSON.stringify(violations)}`);
});

runAssertion('Structural Regression: async helper results cannot create country state', () => {
  for (const expression of ['await getLocale()', 'await Promise.resolve(locale)']) {
    const code = `
      async function run() {
        const getLocale = async () => locale;
        result.countryCode = ${expression};
      }
    `;
    const violations = auditSourceFile('test-async-helper-country-state.ts', code);
    assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction assignment "result.countryCode"')),
      `Must reject async expression ${expression} at the country boundary, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Structural Regression: computed country sink keys are forbidden', () => {
  for (const assignment of [
    `const key = 'countryCode'; result[key] = locale;`,
    'const key = `country${"Code"}`; result[key] = locale;',
  ]) {
    const violations = auditSourceFile('test-dynamic-country-sink.ts', assignment);
    assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction assignment')),
      `Must reject dynamic computed sink ${assignment}, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Structural Regression: computed object country properties are forbidden', () => {
  for (const code of [
    `const key = 'countryCode'; const request = { [key]: locale };`,
    `let key = 'countryCode'; const request = { [key]: locale };`,
    `function make(key = 'countryCode') { return { [key]: locale }; }`,
  ]) {
    const violations = auditSourceFile('test-computed-object-country.ts', code);
    assert.ok(violations.some((v) => v.includes('country/jurisdiction property creation')
      || v.includes('Tainted computed property construction')),
    `Must reject computed object construction ${code}, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Structural Regression: destructuring assignments cannot target country state', () => {
  for (const assignment of [
    `({ locale: result.countryCode } = params);`,
    `[result.countryCode] = [locale];`,
    `result.countryCode ??= locale;`,
    `result.countryCode ||= locale;`,
  ]) {
    const violations = auditSourceFile('test-destructuring-country-target.ts', assignment);
    assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction assignment "result.countryCode"')),
      `Must reject destructuring target ${assignment}, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Structural Regression: destructured declarations and parameters cannot create country state', () => {
  for (const source of [
    `const { locale: countryCode } = params;`,
    `function render({ jurisdiction: scope }) { return scope; }`,
    `const [country] = values;`,
  ]) {
    const violations = auditSourceFile('test-destructured-country-binding.ts', source);
    assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction')),
      `Must reject country binding ${source}, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Structural Regression: reflective mutation APIs cannot create country state', () => {
  for (const statement of [
    `Reflect.set(result, 'countryCode', locale);`,
    `Reflect['set'](result, 'countryCode', locale);`,
    `Object.defineProperty(result, 'countryCode', { value: locale });`,
    `Object.defineProperty(result, 'resolveCountry', { value: () => locale });`,
    `Object['defineProperty'](result, 'countryCode', { value: locale });`,
    `Reflect.defineProperty(result, 'countryCode', { value: locale });`,
    `Object.defineProperties(result, { countryCode: { value: locale } });`,
    `result.set('countryCode', locale);`,
    `Object.fromEntries([['countryCode', locale]]);`,
    `const entries = [['countryCode', locale]]; Object.fromEntries(entries);`,
    `const entries = [['countryCode', locale]]; Object.fromEntries([...entries]);`,
    `const entries = [['countryCode', locale]]; const wrapped = [...entries]; Object.fromEntries(wrapped);`,
    `const field = request.field; Object.fromEntries([[field, locale]]);`,
    `const make = Object.fromEntries; make([['countryCode', locale]]);`,
    `const define = Object.defineProperty; define(api, 'resolveCountry', { value: () => locale });`,
    `const { fromEntries: make } = Object; make([['countryCode', locale]]);`,
    `const { defineProperty: define } = Object; define(api, 'resolveCountry', { value: () => locale });`,
    `const { set } = globalThis.Reflect; set(api, 'countryCode', locale);`,
    `globalThis.Object.fromEntries([['countryCode', locale]]);`,
    `globalThis['Object']['defineProperty'](api, 'resolveCountry', { value: () => locale });`,
  ]) {
    const violations = auditSourceFile('test-reflective-country-mutation.ts', statement);
    assert.ok(violations.some((v) => v.includes('Structural mutation API cannot create country/jurisdiction sink')
      || v.includes('Dynamic property construction API')),
      `Must reject reflective mutation ${statement}, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Structural Regression: class country members are forbidden', () => {
  const code = `
    class Context {
      countryCode = 'RO';
      get jurisdiction() { return 'RO'; }
      set marketCountry(value) { void value; }
    }
  `;
  const violations = auditSourceFile('test-class-country-members.ts', code);
  assert.ok(violations.filter((v) => v.includes('Structural country/jurisdiction class member')).length >= 3,
    `Must reject class country state, got: ${JSON.stringify(violations)}`);
});

runAssertion('Structural Regression: resolver properties and computed resolver calls are forbidden', () => {
  const propertyCode = `
    const action = () => locale;
    const api = { resolveCountry: action };
    const { resolveCountry: pick } = api;
    pick();
  `;
  const propertyViolations = auditSourceFile('test-resolver-property.ts', propertyCode);
  assert.ok(propertyViolations.some((v) => v.includes('Structural country/jurisdiction resolver property "resolveCountry"')),
    `Must reject resolver properties, got: ${JSON.stringify(propertyViolations)}`);

  const callCode = `const method = 'resolveCountry'; api[method]();`;
  const callViolations = auditSourceFile('test-computed-resolver-call.ts', callCode);
  assert.ok(callViolations.some((v) => v.includes('Country/jurisdiction call sink "api[method]"')),
    `Must reject computed resolver calls, got: ${JSON.stringify(callViolations)}`);

  const methodCode = `
    const method = 'resolveCountry';
    const api = { [method]() { return locale; } };
  `;
  const methodViolations = auditSourceFile('test-computed-resolver-method.ts', methodCode);
  assert.ok(methodViolations.some((v) => v.includes('Structural country/jurisdiction resolver "resolveCountry"')),
    `Must reject computed resolver methods, got: ${JSON.stringify(methodViolations)}`);

  const shorthandCode = `
    const action = () => locale;
    const resolveCountry = action;
    const api = { resolveCountry };
  `;
  const shorthandViolations = auditSourceFile('test-shorthand-resolver-property.ts', shorthandCode);
  assert.ok(shorthandViolations.some((v) => v.includes('Structural country/jurisdiction resolver property "resolveCountry"')),
    `Must reject shorthand resolver properties, got: ${JSON.stringify(shorthandViolations)}`);
});

runAssertion('Structural Regression: presentation-only computed assignments remain benign', () => {
  const code = `
    translations[locale] = label;
    const value = 'RO';
    const messages = { [locale]: value };
    const view = { countryLabel: 'Country' };
    const flags = { countryFlag: '🇷🇴', countryIcon: 'flag' };
    const { countryLabel } = translations;
    const { countryFlag } = translations;
    renderCountryLabel(countryLabel);
    renderCountryFlag(countryFlag);
    console.log(messages);
  `;
  const violations = auditSourceFile('test-presentation-computed-assignment.ts', code);
  assert.deepEqual(violations, [],
    `Presentation-only assignment must not be treated as country state, got: ${JSON.stringify(violations)}`);
});

runAssertion('Structural Regression: constant lookup is lexical-scope aware', () => {
  const bypass = auditSourceFile('test-shadow-bypass.ts', `
    { const key = 'countryCode'; const request = { [key]: locale }; }
    { const key = 'label'; void key; }
  `);
  assert.ok(bypass.some((v) => v.includes('Structural country/jurisdiction property creation "countryCode"')),
    `Shadowing must not hide a country sink, got: ${JSON.stringify(bypass)}`);

  const benign = auditSourceFile('test-shadow-false-positive.ts', `
    { const key = 'label'; const view = { [key]: 'Country' }; void view; }
    { const key = 'countryCode'; void key; }
  `);
  assert.deepEqual(benign, [],
    `Sibling country constant must not taint a presentation key, got: ${JSON.stringify(benign)}`);

  const reassigned = auditSourceFile('test-flow-aware-let.ts', `
    let key = 'countryCode';
    key = 'label';
    const view = { [key]: 'Country' };
  `);
  assert.deepEqual(reassigned, [],
    `Latest stable assignment must control a computed presentation key, got: ${JSON.stringify(reassigned)}`);

  const conditional = auditSourceFile('test-conditional-let.ts', `
    let key = 'countryCode';
    if (condition) key = 'label';
    const result = { [key]: locale };
  `);
  assert.ok(conditional.some((v) => v.includes('Tainted computed property construction')),
    `Conditional assignment must not erase a possible country sink, got: ${JSON.stringify(conditional)}`);
});

runAssertion('Structural Regression: country resolvers are forbidden regardless of header access syntax', () => {
  for (const accessor of [
    `request.headers['get']('accept-language')`,
    `request.headers.get(headerName)`,
    `request.headers.get('accept-' + 'language')`,
  ]) {
    const code = `function resolveCountry() { return ${accessor}; }`;
    const violations = auditSourceFile('test-header-country-resolver.ts', code);
    assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction resolver "resolveCountry"')),
      `Must reject resolver using ${accessor}, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Structural Regression: executable modules cannot construct static country state', () => {
  const violations = auditSourceFile('src/app/[lang]/resources/guides/test.ts', `
    const request = { countryCode: 'RO' };
    const country = 'RO';
  `);
  assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction property creation "countryCode"')),
    `Must reject static country property construction, got: ${JSON.stringify(violations)}`);
  assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction variable "country"')),
    `Must reject static country variables, got: ${JSON.stringify(violations)}`);
});

runAssertion('Structural Regression: canonical guide data permits only the exact country/RO applicability shape', () => {
  const valid = auditSourceFile('src/data/guides/test.ts', `
    const article = { contentApplicability: { kind: 'country', countryCode: 'RO' } };
  `);
  assert.deepEqual(valid, [], `Exact canonical applicability must remain valid, got: ${JSON.stringify(valid)}`);

  for (const invalid of [
    `const article = { contentApplicability: { kind: 'country', countryCode: 'IR' } };`,
    `const article = { contentApplicability: { kind: 'country', countryCode: locale } };`,
    `const article = { contentApplicability: { kind: 'global', countryCode: 'RO' } };`,
  ]) {
    const violations = auditSourceFile('src/data/guides/test.ts', invalid);
    assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction property creation "countryCode"')),
      `Must reject noncanonical applicability ${invalid}, got: ${JSON.stringify(violations)}`);
  }

  for (const forbidden of [
    `const countryCode = 'RO';`,
    `const api = { resolveCountry() { return 'RO'; } };`,
  ]) {
    const violations = auditSourceFile('src/data/guides/test.ts', forbidden);
    assert.ok(violations.some((v) => v.includes('Structural country/jurisdiction')),
      `Canonical modules must not receive a file-wide exemption: ${forbidden}; got: ${JSON.stringify(violations)}`);
  }

  const unresolved = auditSourceFile('src/app/[lang]/resources/guides/test.ts', `
    const field = request.field;
    const result = { [field]: 'RO' };
  `);
  assert.ok(unresolved.some((v) => v.includes('Tainted computed property construction')),
    `Unknown computed key with country value must fail closed, got: ${JSON.stringify(unresolved)}`);

  for (const source of [
    `const field = request.field; const value = 'RO'; const result = { [field]: value };`,
    `const field = request.field; const value = condition ? 'RO' : 'DE'; const result = { [field]: value };`,
  ]) {
    const violations = auditSourceFile('src/app/[lang]/resources/guides/test.ts', source);
    assert.ok(violations.some((v) => v.includes('Tainted computed property construction')),
      `Country-valued neutral aliases must fail closed: ${source}; got: ${JSON.stringify(violations)}`);
  }
});

// -----------------------------------------------------------------------------
// Assertion 3.10: Recursive Local TS/TSX Module Graph Discovery & Audit
// -----------------------------------------------------------------------------
function collectStaticLocalModuleSpecifiers(sourceFile) {
  const specifiers = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1
      && (ts.isStringLiteral(node.arguments[0])
        || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) {
      if ((ts.isIdentifier(node.expression) && node.expression.text === 'require')
        || node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        specifiers.push(node.arguments[0].text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

function buildReachableFileGraph() {
  const visited = new Set();
  const queue = [];

  function addRoot(dirOrFile) {
    const full = path.join(projectRoot, dirOrFile);
    if (!fs.existsSync(full)) return;
    if (fs.statSync(full).isDirectory()) {
      for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        const child = path.join(dirOrFile, entry.name);
        addRoot(child);
      }
    } else if (/\.(ts|tsx|js|mjs)$/.test(dirOrFile)) {
      queue.push(path.normalize(full));
    }
  }

  // 1. Guide data files
  addRoot('src/data/guides');
  addRoot('src/data/guides-articles.ts');

  // 2. Guide route files
  addRoot('src/app/[lang]/resources/guides');

  function resolveModulePath(containingFile, specifier) {
    let candidateBase = null;
    if (specifier.startsWith('@/')) {
      candidateBase = path.join(projectRoot, 'src', specifier.slice(2));
    } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
      candidateBase = path.resolve(path.dirname(containingFile), specifier);
    } else {
      return null;
    }

    const extensions = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];
    if (fs.existsSync(candidateBase) && fs.statSync(candidateBase).isFile()) {
      return candidateBase;
    }
    for (const ext of extensions) {
      const full = candidateBase + ext;
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return full;
      }
    }
    return null;
  }

  while (queue.length > 0) {
    const file = queue.shift();
    const normalized = path.normalize(file);
    if (visited.has(normalized)) continue;
    if (!fs.existsSync(normalized) || !fs.statSync(normalized).isFile()) continue;

    visited.add(normalized);

    const source = fs.readFileSync(normalized, 'utf8');
    const sf = ts.createSourceFile(normalized, source, ts.ScriptTarget.Latest, true);

    for (const specifier of collectStaticLocalModuleSpecifiers(sf)) {
      const resolved = resolveModulePath(normalized, specifier);
      if (resolved && !visited.has(path.normalize(resolved))) {
        queue.push(path.normalize(resolved));
      }
    }
  }

  return Array.from(visited).map(f => path.relative(projectRoot, f).replace(/\\/g, '/'));
}

runAssertion('Recursive import discovery includes literal dynamic imports', () => {
  const sf = ts.createSourceFile('dynamic-import.ts', `
    import './static-helper';
    export { value } from './export-helper';
    const lazy = import('./dynamic-helper');
    const lazyTemplate = import(\`./dynamic-template-helper\`);
    const legacy = require('./legacy-helper');
  `, ts.ScriptTarget.Latest, true);
  assert.deepEqual(collectStaticLocalModuleSpecifiers(sf), [
    './static-helper',
    './export-helper',
    './dynamic-helper',
    './dynamic-template-helper',
    './legacy-helper',
  ]);
});

runAssertion('Recursive import discovery rejects nonliteral dynamic imports', () => {
  for (const call of ['import(modulePath)', 'require(modulePath)']) {
    const violations = auditSourceFile('src/app/[lang]/resources/guides/dynamic.ts', `
      const modulePath = './hidden-country-helper';
      const helper = ${call};
    `);
    assert.ok(violations.some((v) => v.includes('Dynamic module specifier is forbidden')),
      `Must reject module load ${call} the graph cannot resolve, got: ${JSON.stringify(violations)}`);
  }
});

runAssertion('Recursive local TS/TSX module import graph discovers all reachable guide and route dependencies', () => {
  const discoveredFiles = buildReachableFileGraph();
  assert.ok(discoveredFiles.length >= 10,
    `Expected at least 10 discovered files in reachable module graph, got ${discoveredFiles.length}`);
  assert.ok(discoveredFiles.includes('src/data/guides/registry.ts'), 'Must include registry.ts');
  assert.ok(discoveredFiles.includes('src/data/guides/types.ts'), 'Must include types.ts');
  assert.ok(discoveredFiles.includes('src/data/guides-articles.ts'), 'Must include guides-articles.ts');
  assert.ok(discoveredFiles.includes('src/app/[lang]/resources/guides/page.tsx'), 'Must include guides list page');
  assert.ok(discoveredFiles.includes('src/app/[lang]/resources/guides/[slug]/page.tsx'), 'Must include guides slug page');
});

runAssertion('Deterministic AST taint analysis on all reachable module graph files discovers zero forbidden locale inferences', () => {
  const discoveredFiles = buildReachableFileGraph();
  const discoveredViolations = [];

  for (const relFile of discoveredFiles) {
    const code = readFile(relFile);
    const fileViolations = auditSourceFile(relFile, code);
    if (fileViolations.length > 0) {
      discoveredViolations.push(...fileViolations);
    }
  }

  assert.equal(discoveredViolations.length, 0,
    `Discovered forbidden locale inference violations in reachable module graph:\n${discoveredViolations.join('\n')}`);
});

runAssertion('Architecture documentation affirms Romanian scope is independent and not derived from locale=ro', () => {
  const archDoc = readFile('docs/seo/CLADORA-INTERNATIONAL-SEO-ARCHITECTURE-v1.0.md');
  assert.ok(
    archDoc.includes('Aceste articole sunt înregistrate independent cu domeniul de aplicabilitate editorial `RO`; `locale=ro` NU este originea acestui domeniu') ||
    archDoc.includes('این مقاله‌ها مستقلاً با scope تحریریه RO ثبت شده‌اند؛ locale=ro منشأ این scope نیست'),
    'Architecture document must affirm Romanian scope is independent and not derived from locale=ro'
  );
  assert.ok(!archDoc.includes('| `RO` (Romanian Country Pack active) |'),
    'Old table conflating locale with jurisdiction must be eliminated');
});

// -----------------------------------------------------------------------------
// Assertion 4: Country-scoped articles have valid countryCode, disclaimer & legalSources
// -----------------------------------------------------------------------------
runAssertion('Country-scoped articles (RO) have valid countryCode, non-empty disclaimer and legalSources', () => {
  const articleList = Object.values(publishedArticles);
  const countryArticles = articleList.filter((a) => a.contentApplicability?.kind === 'country');

  assert.equal(countryArticles.length, 11, 'Expected 11 country-scoped articles');

  for (const art of countryArticles) {
    assert.equal(art.contentApplicability.countryCode, 'RO', `Article ${art.slug} must have countryCode 'RO'`);
    assert.ok(typeof art.disclaimer === 'string' && art.disclaimer.length > 50,
      `Article ${art.slug} must have a substantial operational disclaimer`);
    const lowerDisclaimer = art.disclaimer.toLowerCase();
    assert.ok(
      lowerDisclaimer.includes('informativ') ||
      lowerDisclaimer.includes('consultanță') ||
      lowerDisclaimer.includes('nu înlocuiește') ||
      lowerDisclaimer.includes('nu reprezintă') ||
      lowerDisclaimer.includes('nu constituie'),
      `Article ${art.slug} disclaimer must qualify operational vs legal/accounting advisory`
    );

    assert.ok(Array.isArray(art.legalSources) && art.legalSources.length > 0,
      `Article ${art.slug} must contain at least one legalSource`);

    for (const src of art.legalSources) {
      assert.ok(typeof src.title === 'string' && src.title.length > 0, `Article ${art.slug} source missing title`);
      assert.ok(typeof src.reference === 'string' && src.reference.length > 0, `Article ${art.slug} source missing reference`);
      assert.ok(typeof src.accessDate === 'string' && src.accessDate.length > 0, `Article ${art.slug} source missing accessDate`);
    }
  }
});

// -----------------------------------------------------------------------------
// Assertion 5: Global/cross-border articles do not claim active Country Pack or local compliance
// -----------------------------------------------------------------------------
runAssertion('Global/cross-border articles include mandatory disclaimer and do not claim active Country Pack', () => {
  const articleList = Object.values(publishedArticles);
  const globalArticles = articleList.filter((a) => a.contentApplicability?.kind === 'global');

  assert.equal(globalArticles.length, 3, 'Expected 3 global articles (2 EN + 1 FA)');

  for (const art of globalArticles) {
    assert.ok(typeof art.disclaimer === 'string' && art.disclaimer.length > 50,
      `Global article ${art.slug} must have a disclaimer`);

    // Verify disclaimer disclaims active Country Pack and production legal compliance
    if (art.lang === 'en') {
      assert.ok(
        art.disclaimer.includes('does not announce an active Country Pack or production legal compliance'),
        `EN article ${art.slug} disclaimer must state it does not announce an active Country Pack or production legal compliance`
      );
      assert.ok(
        art.disclaimer.includes("Requirements of the asset's location country must be verified independently"),
        `EN article ${art.slug} disclaimer must require independent verification`
      );
    } else if (art.lang === 'fa') {
      assert.ok(
        art.disclaimer.includes('الزامات کشور محل ملک باید جداگانه با منابع جاری و بازبینی واجد صلاحیت تأیید شوند') &&
        art.disclaimer.includes('این مقاله فعال‌بودن Country Pack یا انطباق حقوقی تولیدی را اعلام نمی‌کند'),
        `FA article ${art.slug} disclaimer must match approved Persian disclaimer text`
      );
    }

    // Must not have statutory legalSources claiming local compliance
    assert.ok(!art.legalSources || art.legalSources.length === 0,
      `Global article ${art.slug} must not declare jurisdiction statutory legal sources`);
  }
});

// -----------------------------------------------------------------------------
// Assertion 6: Purge of forbidden phrases ("Romanian Country Pack active", "Country Pack Gateway")
// -----------------------------------------------------------------------------
runAssertion('Forbidden misleading active-pack phrases and unproven claims are completely purged', () => {
  const filesToScan = [
    'docs/seo/CLADORA-INTERNATIONAL-SEO-ARCHITECTURE-v1.0.md',
    'docs/seo/CLADORA-EN-KEYWORD-INTENT-MAP-v1.0.md',
    'docs/seo/CLADORA-FA-KEYWORD-INTENT-MAP-v1.0.md',
    'docs/seo/CLADORA-INTERNATIONAL-EDITORIAL-GUIDELINES-v1.0.md',
    'src/data/guides/types.ts',
    'src/data/guides/cluster-platform.ts',
    'src/data/guides/cluster-a-associations.ts',
    'src/data/guides/cluster-b-operations.ts',
    'src/data/guides/cluster-c-property-managers.ts',
  ];

  const forbiddenTerms = [
    'Romanian Country Pack active',
    'Country Pack Gateway',
    'strict Country Pack Gateway',
    'native semantic precision',
    'native domain fluency',
  ];

  for (const relFile of filesToScan) {
    const content = readFile(relFile);
    for (const term of forbiddenTerms) {
      assert.ok(!content.toLowerCase().includes(term.toLowerCase()),
        `File ${relFile} contains forbidden phrase: "${term}"`);
    }
  }

  // Verify explicit inactive truth in architecture document
  const archDoc = readFile('docs/seo/CLADORA-INTERNATIONAL-SEO-ARCHITECTURE-v1.0.md');
  assert.ok(archDoc.includes('Country Pack Runtime: `NOT_ACTIVE`') || archDoc.includes('Country Pack runtime is `NOT_ACTIVE`'),
    'Architecture doc must explicitly state Country Pack Runtime: NOT_ACTIVE');
  assert.ok(archDoc.includes('Remote Installation / Activation: `NOT_RUN_NOT_PASS`') || archDoc.includes('remote activation is `NOT_RUN_NOT_PASS`'),
    'Architecture doc must explicitly state Remote Installation / Activation: NOT_RUN_NOT_PASS');

  // Verify procedural requirement statement for terminology review
  assert.ok(archDoc.includes('must undergo language and domain terminology review'),
    'Architecture doc must state procedural terminology review requirement');
});

// -----------------------------------------------------------------------------
// Assertion 7: Real Deterministic Sitemap Execution: 32 base routes × 3 + 3 authors + 14 guides = 113 unique URLs
// -----------------------------------------------------------------------------
runAssertion('Deterministic sitemap execution yields exactly 113 unique URLs with zero collisions', () => {
  // Transpile and evaluate src/app/sitemap.ts in VM
  const sitemapSource = readFile('src/app/sitemap.ts');
  const sitemapJs = ts.transpileModule(sitemapSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const mockGetSiteUrl = () => 'https://cladora.ro';
  const mockGetAllGuideArticles = () => Object.values(publishedArticles);

  const context = {
    exports: {},
    require: (id) => {
      if (id.includes('site') || id === '@/config/site') return { getSiteUrl: mockGetSiteUrl };
      if (id.includes('guides-articles') || id === '@/data/guides-articles') {
        return { getAllGuideArticles: mockGetAllGuideArticles };
      }
      return {};
    },
  };
  vm.createContext(context);
  vm.runInContext(sitemapJs, context);
  const sitemapFn = context.exports.default;
  assert.equal(typeof sitemapFn, 'function', 'sitemap default export must be a function');

  const entries = sitemapFn();
  assert.ok(Array.isArray(entries), 'sitemap() must return an array');

  // 1. Exact total entry count
  assert.equal(entries.length, 113, `Sitemap must contain exactly 113 entries, found ${entries.length}`);

  // 2. Exact uniqueness / zero collisions
  const urlList = entries.map((e) => e.url);
  const uniqueUrls = new Set(urlList);
  assert.equal(uniqueUrls.size, 113, `All 113 sitemap URLs must be unique (zero collision). Unique count: ${uniqueUrls.size}`);

  // 3. Category breakdowns
  const guideUrls = urlList.filter((u) => u.includes('/resources/guides/'));
  const authorUrls = urlList.filter((u) => u.includes('/resources/autori/'));
  const baseUrls = urlList.filter((u) => !u.includes('/resources/guides/') && !u.includes('/resources/autori/'));

  assert.equal(baseUrls.length, 96, `Expected exactly 96 base route URLs (32 routes × 3 languages), got ${baseUrls.length}`);
  assert.equal(authorUrls.length, 3, `Expected exactly 3 author URLs (1 route × 3 languages), got ${authorUrls.length}`);
  assert.equal(guideUrls.length, 14, `Expected exactly 14 guide URLs, got ${guideUrls.length}`);
  assert.equal(baseUrls.length + authorUrls.length + guideUrls.length, 113, 'Breakdown sum must equal 113');

  // 4. Verification of guide URLs by language partition
  const roGuideUrls = guideUrls.filter((u) => u.startsWith('https://cladora.ro/ro/'));
  const enGuideUrls = guideUrls.filter((u) => u.startsWith('https://cladora.ro/en/'));
  const faGuideUrls = guideUrls.filter((u) => u.startsWith('https://cladora.ro/fa/'));

  assert.equal(roGuideUrls.length, 11, 'Expected 11 Romanian guide URLs');
  assert.equal(enGuideUrls.length, 2, 'Expected 2 English guide URLs');
  assert.equal(faGuideUrls.length, 1, 'Expected 1 Persian guide URL');

  // Verify all 14 published articles match their sitemap URLs
  for (const art of Object.values(publishedArticles)) {
    const expectedUrl = `https://cladora.ro/${art.lang}/resources/guides/${art.slug}`;
    assert.ok(uniqueUrls.has(expectedUrl), `Sitemap missing expected article URL: ${expectedUrl}`);
  }

  // Canonical guard on guide page source
  const guidePage = readFile('src/app/[lang]/resources/guides/[slug]/page.tsx');
  assert.ok(guidePage.includes('singleLanguageOnly: true'),
    'Guide article page must enforce singleLanguageOnly: true to prevent fake alternate hreflangs');
});

// -----------------------------------------------------------------------------
// Assertion 8: targetAudience metadata boundary
// -----------------------------------------------------------------------------
runAssertion('targetAudience remains purely editorial metadata with zero runtime authority', () => {
  const typesContent = readFile('src/data/guides/types.ts');
  assert.ok(typesContent.includes('targetAudience?: string;'),
    'targetAudience must be an optional string editorial metadata');

  // Verify it is not used in Core jurisdiction models
  const coreJurisdictionCode = readFile('src/lib/core/jurisdiction-profile-v1.ts');
  assert.ok(!coreJurisdictionCode.includes('targetAudience'),
    'Core jurisdiction model must not import or depend on targetAudience');
});

// -----------------------------------------------------------------------------
// Final Summary
// -----------------------------------------------------------------------------
console.log(`\n=== SUMMARY: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED ===\n`);
if (passedAssertions !== totalAssertions) {
  process.exitCode = 1;
}
