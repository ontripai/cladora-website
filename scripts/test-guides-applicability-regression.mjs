import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('=== RUNNING WP-15B-FIX-6 TAINT-AWARE LOCALE/JURISDICTION REGRESSION TESTS ===\n');

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

  // Track tainted identifiers (sources + alias propagation)
  const taintedVariables = new Set();
  const countryValuedVariables = new Set();

  function bindingNames(pattern, inheritedSource = false) {
    const discovered = [];
    if (ts.isIdentifier(pattern)) {
      discovered.push({ name: pattern.text, source: inheritedSource || isSourceIdentifier(pattern.text) });
    } else if (ts.isObjectBindingPattern(pattern)) {
      for (const element of pattern.elements) {
        const propertyName = element.propertyName && ts.isIdentifier(element.propertyName)
          ? element.propertyName.text
          : '';
        const source = inheritedSource || isSourceIdentifier(propertyName);
        discovered.push(...bindingNames(element.name, source));
      }
    } else if (ts.isArrayBindingPattern(pattern)) {
      for (const element of pattern.elements) {
        if (ts.isBindingElement(element)) discovered.push(...bindingNames(element.name, inheritedSource));
      }
    }
    return discovered;
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
      if (isSourceIdentifier(expr.name.text) || taintedVariables.has(expr.name.text)) {
        return true;
      }
      if (isTainted(expr.expression)) {
        return true;
      }
    }

    // Element access with tainted index
    if (ts.isElementAccessExpression(expr)) {
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
      return expr.arguments.some(isTainted);
    }

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
      } else if (ts.isBindingPattern(node.name)) {
        const inheritedSource = Boolean(node.initializer && isTainted(node.initializer));
        for (const binding of bindingNames(node.name, inheritedSource)) {
          if (binding.source && !taintedVariables.has(binding.name)) {
            taintedVariables.add(binding.name);
            changed = true;
          }
        }
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
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
    if (ts.isElementAccessExpression(expr) && expr.argumentExpression) {
      if (ts.isStringLiteral(expr.argumentExpression)) return expr.argumentExpression.text;
    }
    if (ts.isComputedPropertyName(expr)) return expr.expression.getText(sf);
    return '';
  }

  function isExplicitCountryVariableName(name) {
    return isCountryConstantIdentifier(name)
      || /(country|jurisdiction|marketCountry|region)/i.test(name)
      || /^[A-Z]{2}_CODE$/.test(name);
  }

  function shouldTrackCountryVariable(name, initializer) {
    if (!producesCountryValue(initializer)) return false;
    if (isExplicitCountryVariableName(name)) return true;
    if (ts.isIdentifier(initializer)) return countryValuedVariables.has(initializer.text);
    if (ts.isConditionalExpression(initializer)) return isExplicitCountryExpression(initializer);
    return false;
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
    if (ts.isIdentifier(expr)) {
      return isExplicitCountryVariableName(expr.text) || countryValuedVariables.has(expr.text);
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
      if (/(country|jurisdiction|marketCountry)/i.test(owner)) {
        violations.push(`Tainted return from country/jurisdiction function "${owner}" in ${filePath}`);
      }
    }

    if (ts.isArrowFunction(node) && !ts.isBlock(node.body) && isTainted(node.body)) {
      const owner = functionLikeName(node);
      if (/(country|jurisdiction|marketCountry)/i.test(owner)) {
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

// -----------------------------------------------------------------------------
// Assertion 3.10: Recursive Local TS/TSX Module Graph Discovery & Audit
// -----------------------------------------------------------------------------
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

    function visitImports(node) {
      let specifier = null;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specifier = node.moduleSpecifier.text;
      } else if (ts.isCallExpression(node) && node.expression.getText(sf) === 'require' && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
        specifier = node.arguments[0].text;
      }
      if (specifier) {
        const resolved = resolveModulePath(normalized, specifier);
        if (resolved && !visited.has(path.normalize(resolved))) {
          queue.push(path.normalize(resolved));
        }
      }
      ts.forEachChild(node, visitImports);
    }
    visitImports(sf);
  }

  return Array.from(visited).map(f => path.relative(projectRoot, f).replace(/\\/g, '/'));
}

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
