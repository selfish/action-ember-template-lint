// Ember Template Lint Formatter to Output Reviewdog Diagnostic Format (RDFormat)
// https://github.com/reviewdog/reviewdog/blob/1d8f6d6897dcfa67c33a2ccdc2ea23a8cca96c8c/proto/rdf/reviewdog.proto
const process = require('process');

function convertSeverity(s) {
  if (s === 0) { // off
    return 'INFO';
  } else if (s === 1) {
    return 'WARNING';
  } else if (s === 2) {
    return 'ERROR';
  }
  return 'UNKNOWN_SEVERITY';
}

function utf8length(str) {
  return unescape(encodeURIComponent(str)).length;
}

function buildMinimumRange(diagnostic) {
  const { line, column, source } = diagnostic;
  return {
    start: { line, column: column + 1 },
    end: { line, column: column + utf8length(source) + 1 }
  }
}

function buildMinimumSuggestion(diagnostic) {
  return {
    range: buildMinimumRange(diagnostic),
    text: diagnostic.fix.text
  };
}

function formatDiagnostic(diagnostic) {

  const { filePath } = diagnostic;

  let formattedDiagnostic = {
    message: diagnostic.message,
    location: {
      path: filePath,
      range: buildMinimumRange(diagnostic)
    },
    severity: convertSeverity(diagnostic.severity),
    code: {
      value: diagnostic.rule,
      url: `https://github.com/ember-template-lint/ember-template-lint/blob/master/docs/rule/${diagnostic.rule}.md`
    },
    original_output: JSON.stringify(diagnostic)
  };

  if (diagnostic.fix) {
    formattedDiagnostic.suggestions = [buildMinimumSuggestion(diagnostic)];
  }

  return formattedDiagnostic;
}

function buildRdJsonOutput(results) {
  return {
    source: {
      name: 'ember-template-lint',
      url: 'https://github.com/ember-template-lint/ember-template-lint'
    },
    diagnostics: Object.values(results).flat().map(formatDiagnostic)
  };
}

let data = '';

process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function(chunk) {
  data += chunk;
});

process.stdin.on('end', function() {
  const parsed = JSON.parse(data);
  const rdJson = buildRdJsonOutput(parsed);
  console.log(JSON.stringify(rdJson));
});

// const data = require('./test-fix.json');
// const rdJson = buildRdJsonOutput(data);
// console.log(JSON.stringify(rdJson));
