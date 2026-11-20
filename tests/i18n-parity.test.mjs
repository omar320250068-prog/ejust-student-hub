import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const i18nPath = path.resolve(here, "../src/lib/i18n.tsx");
const sourceFile = ts.createSourceFile(
  i18nPath,
  readFileSync(i18nPath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function unwrap(node) {
  while (
    node &&
    (ts.isAsExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      (ts.isSatisfiesExpression && ts.isSatisfiesExpression(node)))
  ) {
    node = node.expression;
  }
  return node;
}

function propertyName(property) {
  if (!property.name) return null;
  if (
    ts.isIdentifier(property.name) ||
    ts.isStringLiteral(property.name) ||
    ts.isNumericLiteral(property.name)
  ) {
    return property.name.text;
  }
  return null;
}

function flatten(objectLiteral, prefix = "") {
  const leaves = new Map();
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property);
    if (!name) continue;

    const key = prefix ? `${prefix}.${name}` : name;
    const value = unwrap(property.initializer);
    if (value && ts.isObjectLiteralExpression(value)) {
      for (const [nestedKey, nestedValue] of flatten(value, key)) {
        leaves.set(nestedKey, nestedValue);
      }
    } else if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
      leaves.set(key, value.text);
    }
  }
  return leaves;
}

const dictionaries = {};
let translationKeyUnion = "";

function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "dictionaries" &&
    node.initializer
  ) {
    const literal = unwrap(node.initializer);
    if (ts.isObjectLiteralExpression(literal)) {
      for (const property of literal.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const locale = propertyName(property);
        const value = unwrap(property.initializer);
        if (locale && value && ts.isObjectLiteralExpression(value)) {
          dictionaries[locale] = flatten(value);
        }
      }
    }
  }

  if (ts.isTypeAliasDeclaration(node) && node.name.text === "TranslationKey") {
    translationKeyUnion = node.type.getText(sourceFile);
  }

  ts.forEachChild(node, visit);
}
visit(sourceFile);

function placeholders(text) {
  return [...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)]
    .map((match) => match[1])
    .sort();
}

test("en/ar/ja dictionaries expose the same keys with non-empty values and matching placeholders", () => {
  assert.deepEqual(Object.keys(dictionaries).sort(), ["ar", "en", "ja"]);

  const english = dictionaries.en;
  const englishKeys = [...english.keys()].sort();

  for (const locale of ["ar", "ja"]) {
    const localized = dictionaries[locale];
    assert.deepEqual(
      [...localized.keys()].sort(),
      englishKeys,
      `${locale} keys must match en exactly`,
    );

    for (const key of englishKeys) {
      const value = localized.get(key);
      assert.notEqual(value.trim(), "", `${locale}.${key} must not be empty`);
      assert.deepEqual(
        placeholders(value),
        placeholders(english.get(key)),
        `${locale}.${key} placeholders must match en`,
      );
    }
  }
});

test("every dictionary group is included in the TranslationKey union", () => {
  const groups = new Set([...dictionaries.en.keys()].map((key) => key.split(".")[0]));
  for (const group of groups) {
    assert.ok(
      translationKeyUnion.includes(`${group}.`),
      `TranslationKey must include the ${group} group`,
    );
  }
});
